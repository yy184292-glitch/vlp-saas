from __future__ import annotations

from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.models.valuation_settings import ValuationSettings


@dataclass(frozen=True)
class MarketPrice:
    low: int
    median: int
    high: int


def _round_to_unit(value: int, unit: int) -> int:
    if unit <= 0:
        return value
    return int(round(value / unit) * unit)


def _fetch_market_price_stub(*, make: str, model: str, grade: str, year: int, mileage: int) -> MarketPrice:
    """
    まずはスタブ（運用上の土台）。
    次のステップで外部API + valuation_cache_external に差し替える。
    """
    base = 1_000_000
    return MarketPrice(low=int(base * 0.9), median=base, high=int(base * 1.1))


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


def update_settings(db: Session, store_id, patch: dict) -> ValuationSettings:
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
    settings = get_or_create_settings(db, store_id)
    market = _fetch_market_price_stub(make=make, model=model, grade=grade, year=year, mileage=mileage)

    buy_cap_pct = float(settings.buy_cap_pct)
    risk_buffer = int(settings.risk_buffer_yen)

    buy_cap_price = int(market.median * buy_cap_pct) - risk_buffer

    # いったん中央値（後で display_adjust_pct 等を適用）
    recommended_price = market.median

    # “運用でキリの良い金額”に丸める
    unit = int(settings.round_unit_yen)
    recommended_price = _round_to_unit(recommended_price, unit)
    buy_cap_price = _round_to_unit(buy_cap_price, unit)

    expected_profit = recommended_price - buy_cap_price
    expected_profit_rate = (expected_profit / recommended_price) if recommended_price > 0 else 0.0

    return {
        "market_low": market.low,
        "market_median": market.median,
        "market_high": market.high,
        "buy_cap_price": buy_cap_price,
        "recommended_price": recommended_price,
        "expected_profit": expected_profit,
        "expected_profit_rate": float(expected_profit_rate),
    }
