from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping

from sqlalchemy.orm import Session

from app.models.valuation_settings import ValuationSettings


@dataclass(frozen=True)
class MarketPrice:
    low: int
    median: int
    high: int


# -----------------------------
# Rounding helpers (deterministic)
# -----------------------------
def _round_down_to_unit(value: int, unit: int) -> int:
    """Round down toward -inf by unit. For money, we usually want floor for buy cap."""
    if unit <= 0:
        return value
    # Python's // floors for negatives too, which is acceptable for money here
    return (value // unit) * unit


def _round_up_to_unit(value: int, unit: int) -> int:
    """Round up toward +inf by unit. For money, we usually want ceil for recommended sell price."""
    if unit <= 0:
        return value
    if value >= 0:
        return ((value + unit - 1) // unit) * unit
    # For negative values, "round up" means closer to 0
    return -((-value) // unit) * unit


def _to_int_safe(value: Any, *, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_decimal_safe(value: Any, *, default: Decimal = Decimal("0")) -> Decimal:
    try:
        if value is None:
            return default
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return default


def _clamp_decimal(v: Decimal, lo: Decimal, hi: Decimal) -> Decimal:
    return max(lo, min(hi, v))


# -----------------------------
# Market provider (stub for now)
# -----------------------------
def _fetch_market_price_stub(*, make: str, model: str, grade: str, year: int, mileage: int) -> MarketPrice:
    """
    まずはスタブ（運用上の土台）。
    次のステップで外部API + valuation_cache_external に差し替える。
    """
    base = 1_000_000
    return MarketPrice(low=int(base * 0.9), median=base, high=int(base * 1.1))


# -----------------------------
# Settings CRUD
# -----------------------------
def get_or_create_settings(db: Session, store_id) -> ValuationSettings:
    """
    1店舗1レコードの設定を取得。無ければデフォルトで作成する。
    DB側に server_default がある想定なので store_id だけで作れる。
    """
    settings = db.query(ValuationSettings).filter(ValuationSettings.store_id == store_id).first()
    if settings:
        return settings

    settings = ValuationSettings(store_id=store_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_settings(db: Session, store_id, patch: Mapping[str, Any]) -> ValuationSettings:
    """
    設定更新（許可フィールドのみ、Noneは無視）。
    """
    settings = get_or_create_settings(db, store_id)

    allowed = {
        "provider",
        "display_adjust_pct",
        "buy_cap_pct",
        "recommended_from_cap_yen",
        "risk_buffer_yen",
        "round_unit_yen",
        "default_extra_cost_yen",
        "min_profit_yen",
        "min_profit_rate",
    }

    for k, v in patch.items():
        if k in allowed and v is not None:
            setattr(settings, k, v)

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


# -----------------------------
# Core valuation logic (product-ready)
# -----------------------------
def calculate_valuation(
    *,
    db: Session,
    store_id,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
) -> dict:
    """
    商品版の計算ロジック（settings反映）:
      - market_* はスタブ（将来 provider + cache に差し替え）
      - display_adjust_pct: 市場価格に補正（計算元にも適用）
      - buy_cap_pct, risk_buffer_yen: 買取上限を算出
      - recommended_from_cap_yen: cap から推奨販売価格を算出
      - default_extra_cost_yen: 利益から控除
      - min_profit_yen / min_profit_rate: 利益下限を満たすまで推奨販売価格を押し上げ
      - round_unit_yen: capは切り下げ、recommendedは切り上げ
    """
    settings = get_or_create_settings(db, store_id)
    market = _fetch_market_price_stub(make=make, model=model, grade=grade, year=year, mileage=mileage)

    unit = max(1, _to_int_safe(getattr(settings, "round_unit_yen", 1000), default=1000))

    # --- display adjust (apply to market baseline used in calc) ---
    display_adjust_pct = _to_decimal_safe(getattr(settings, "display_adjust_pct", 0), default=Decimal("0"))
    # interpret as percent (-100..100) to avoid absurd numbers
    display_adjust_pct = _clamp_decimal(display_adjust_pct, Decimal("-100"), Decimal("100"))
    adj_mul = (Decimal("1") + (display_adjust_pct / Decimal("100")))

    market_low = int((Decimal(market.low) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))
    market_median = int((Decimal(market.median) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))
    market_high = int((Decimal(market.high) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))

    # --- buy cap ---
    buy_cap_pct = _to_decimal_safe(getattr(settings, "buy_cap_pct", 0), default=Decimal("0"))
    # 0..1.2 くらいに抑える（異常値で事故らない）
    buy_cap_pct = _clamp_decimal(buy_cap_pct, Decimal("0"), Decimal("1.2"))

    risk_buffer_yen = max(0, _to_int_safe(getattr(settings, "risk_buffer_yen", 0), default=0))
    cap_raw = int((Decimal(market_median) * buy_cap_pct).to_integral_value(rounding="ROUND_FLOOR")) - risk_buffer_yen
    buy_cap_price = _round_down_to_unit(cap_raw, unit)

    # --- recommended price from cap ---
    recommended_from_cap_yen = _to_int_safe(getattr(settings, "recommended_from_cap_yen", 0), default=0)
    rec_raw = buy_cap_price + recommended_from_cap_yen
    recommended_price = _round_up_to_unit(rec_raw, unit)

    # --- profit (include extra cost) ---
    default_extra_cost_yen = max(0, _to_int_safe(getattr(settings, "default_extra_cost_yen", 0), default=0))
    expected_profit = recommended_price - buy_cap_price - default_extra_cost_yen

    # --- enforce minimum profit constraints by pushing recommended up ---
    min_profit_yen = max(0, _to_int_safe(getattr(settings, "min_profit_yen", 0), default=0))
    min_profit_rate = _to_decimal_safe(getattr(settings, "min_profit_rate", 0), default=Decimal("0"))
    min_profit_rate = _clamp_decimal(min_profit_rate, Decimal("0"), Decimal("1"))

    # Only if recommended_price positive; otherwise compute will be degenerate
    if recommended_price > 0:
        # required by rate (profit >= rate * recommended)
        # profit = recommended - cap - extra
        # => recommended - cap - extra >= rate * recommended
        # => recommended * (1 - rate) >= cap + extra
        # => recommended >= (cap + extra) / (1 - rate)
        if min_profit_rate > 0 and min_profit_rate < 1:
            rhs = Decimal(buy_cap_price + default_extra_cost_yen) / (Decimal("1") - min_profit_rate)
            required_by_rate = int(rhs.to_integral_value(rounding="ROUND_CEILING"))
        elif min_profit_rate >= 1:
            # impossible; fall back to yen constraint only
            required_by_rate = 0
        else:
            required_by_rate = 0

        # required by yen (profit >= min_profit_yen) => recommended >= cap + extra + min_profit_yen
        required_by_yen = buy_cap_price + default_extra_cost_yen + min_profit_yen

        required_recommended = max(recommended_price, required_by_rate, required_by_yen)
        if required_recommended != recommended_price:
            recommended_price = _round_up_to_unit(required_recommended, unit)
            expected_profit = recommended_price - buy_cap_price - default_extra_cost_yen

    expected_profit_rate = (expected_profit / recommended_price) if recommended_price > 0 else 0.0

    return {
        "market_low": market_low,
        "market_median": market_median,
        "market_high": market_high,
        "buy_cap_price": buy_cap_price,
        "recommended_price": recommended_price,
        "expected_profit": expected_profit,
        "expected_profit_rate": float(expected_profit_rate),
    }
