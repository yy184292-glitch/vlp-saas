from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping, Optional

from sqlalchemy import and_, desc
from sqlalchemy.orm import Session

from app.models.valuation_settings import ValuationSettings
from app.models.valuation_cache_external import ValuationCacheExternal

logger = logging.getLogger(__name__)


# ============================================================
# Domain
# ============================================================
@dataclass(frozen=True)
class MarketPrice:
    low: int
    median: int
    high: int


class ExternalProviderError(RuntimeError):
    """External market provider failure (network/timeout/provider down)."""


class UpstreamUnavailableError(RuntimeError):
    """No valid cache and external provider failed."""


# ============================================================
# Helpers: rounding / parsing
# ============================================================
def _round_down_to_unit(value: int, unit: int) -> int:
    """Round down (floor) to unit. Good for buy-cap to avoid overpaying."""
    if unit <= 0:
        return value
    return (value // unit) * unit


def _round_up_to_unit(value: int, unit: int) -> int:
    """Round up (ceil) to unit. Good for recommended sell to avoid underpricing."""
    if unit <= 0:
        return value
    if value >= 0:
        return ((value + unit - 1) // unit) * unit
    # For negative values, round up means closer to 0
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


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_key_part(s: str) -> str:
    """
    Cache key normalization:
      - trim
      - lowercase
      - collapse whitespace
    """
    s = (s or "").strip().lower()
    s = " ".join(s.split())
    return s


# ============================================================
# Settings CRUD
# ============================================================
def get_or_create_settings(db: Session, store_id) -> ValuationSettings:
    """
    1店舗1レコードの設定を取得。無ければデフォルトで作成する。
    DB側に server_default がある前提で store_id だけで作れる想定。
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
    """設定更新（許可フィールドのみ、Noneは無視）。"""
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


# ============================================================
# External Market Provider (stub for now)
# ============================================================
def _fetch_market_price_from_provider_stub(
    *,
    provider: str,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
) -> MarketPrice:
    """
    外部相場プロバイダ（現状スタブ）。
    将来は provider に応じてHTTP/APIクライアントに差し替える。
    """
    base = 1_000_000
    return MarketPrice(low=int(base * 0.9), median=base, high=int(base * 1.1))


# ============================================================
# External cache (valuation_cache_external): 24h
# ============================================================
CACHE_TTL_HOURS = 24


def _cache_filters(
    *,
    store_id,
    provider: str,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
):
    return and_(
        ValuationCacheExternal.store_id == store_id,
        ValuationCacheExternal.provider == provider,
        ValuationCacheExternal.make == make,
        ValuationCacheExternal.model == model,
        ValuationCacheExternal.grade == grade,
        ValuationCacheExternal.year == year,
        ValuationCacheExternal.mileage == mileage,
    )


def _get_valid_external_cache(
    db: Session,
    *,
    store_id,
    provider: str,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
    now: datetime,
) -> Optional[ValuationCacheExternal]:
    """expires_at > now のキャッシュのみ返す（期限内のみ）。"""
    return (
        db.query(ValuationCacheExternal)
        .filter(
            _cache_filters(
                store_id=store_id,
                provider=provider,
                make=make,
                model=model,
                grade=grade,
                year=year,
                mileage=mileage,
            )
        )
        .filter(ValuationCacheExternal.expires_at > now)
        .order_by(desc(ValuationCacheExternal.cached_at))
        .first()
    )


def _save_external_cache(
    db: Session,
    *,
    store_id,
    provider: str,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
    response_json: dict,
    now: datetime,
) -> ValuationCacheExternal:
    """同キーの古いものを残したまま新規追加方式。"""
    expires_at = now + timedelta(hours=CACHE_TTL_HOURS)
    row = ValuationCacheExternal(
        store_id=store_id,
        provider=provider,
        make=make,
        model=model,
        grade=grade,
        year=year,
        mileage=mileage,
        response_json=response_json,
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _market_from_cached_json(response_json: Mapping[str, Any]) -> MarketPrice:
    low = _to_int_safe(response_json.get("market_low"), default=0)
    median = _to_int_safe(response_json.get("market_median"), default=0)
    high = _to_int_safe(response_json.get("market_high"), default=0)
    if low <= 0 or median <= 0 or high <= 0:
        raise ValueError("Invalid cached market price payload")
    return MarketPrice(low=low, median=median, high=high)


def _get_market_price_external_with_cache(
    db: Session,
    *,
    store_id,
    provider: str,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
) -> MarketPrice:
    now = _now_utc()

    provider_n = _normalize_key_part(provider)
    make_n = _normalize_key_part(make)
    model_n = _normalize_key_part(model)
    grade_n = _normalize_key_part(grade)

    cached = _get_valid_external_cache(
        db,
        store_id=store_id,
        provider=provider_n,
        make=make_n,
        model=model_n,
        grade=grade_n,
        year=year,
        mileage=mileage,
        now=now,
    )
    if cached:
        try:
            return _market_from_cached_json(cached.response_json)
        except Exception:
            logger.warning("Invalid cache payload. Falling back to provider fetch.", exc_info=True)

    try:
        market = _fetch_market_price_from_provider_stub(
            provider=provider_n,
            make=make_n,
            model=model_n,
            grade=grade_n,
            year=year,
            mileage=mileage,
        )
        payload = {
            "market_low": market.low,
            "market_median": market.median,
            "market_high": market.high,
            "provider": provider_n,
            "fetched_at": now.isoformat(),
        }
        _save_external_cache(
            db,
            store_id=store_id,
            provider=provider_n,
            make=make_n,
            model=model_n,
            grade=grade_n,
            year=year,
            mileage=mileage,
            response_json=payload,
            now=now,
        )
        return market
    except ExternalProviderError:
        cached2 = _get_valid_external_cache(
            db,
            store_id=store_id,
            provider=provider_n,
            make=make_n,
            model=model_n,
            grade=grade_n,
            year=year,
            mileage=mileage,
            now=now,
        )
        if cached2:
            return _market_from_cached_json(cached2.response_json)
        raise UpstreamUnavailableError("External market provider failed and no valid cache found.") from None


# ============================================================
# Product-ready valuation logic
# ============================================================
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

    provider = getattr(settings, "provider", None) or "MAT"

    market = _get_market_price_external_with_cache(
        db,
        store_id=store_id,
        provider=provider,
        make=make,
        model=model,
        grade=grade,
        year=year,
        mileage=mileage,
    )

    unit = max(1, _to_int_safe(getattr(settings, "round_unit_yen", 1000), default=1000))

    display_adjust_pct = _to_decimal_safe(getattr(settings, "display_adjust_pct", 0), default=Decimal("0"))
    display_adjust_pct = _clamp_decimal(display_adjust_pct, Decimal("-100"), Decimal("100"))
    adj_mul = Decimal("1") + (display_adjust_pct / Decimal("100"))

    market_low = int((Decimal(market.low) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))
    market_median = int((Decimal(market.median) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))
    market_high = int((Decimal(market.high) * adj_mul).to_integral_value(rounding="ROUND_HALF_UP"))

    buy_cap_pct = _to_decimal_safe(getattr(settings, "buy_cap_pct", 0), default=Decimal("0"))
    buy_cap_pct = _clamp_decimal(buy_cap_pct, Decimal("0"), Decimal("1.2"))

    risk_buffer_yen = max(0, _to_int_safe(getattr(settings, "risk_buffer_yen", 0), default=0))

    cap_raw = int((Decimal(market_median) * buy_cap_pct).to_integral_value(rounding="ROUND_FLOOR")) - risk_buffer_yen
    buy_cap_price = _round_down_to_unit(cap_raw, unit)

    recommended_from_cap_yen = _to_int_safe(getattr(settings, "recommended_from_cap_yen", 0), default=0)
    rec_raw = buy_cap_price + recommended_from_cap_yen
    recommended_price = _round_up_to_unit(rec_raw, unit)

    default_extra_cost_yen = max(0, _to_int_safe(getattr(settings, "default_extra_cost_yen", 0), default=0))
    expected_profit = recommended_price - buy_cap_price - default_extra_cost_yen

    min_profit_yen = max(0, _to_int_safe(getattr(settings, "min_profit_yen", 0), default=0))
    min_profit_rate = _to_decimal_safe(getattr(settings, "min_profit_rate", 0), default=Decimal("0"))
    min_profit_rate = _clamp_decimal(min_profit_rate, Decimal("0"), Decimal("1"))

    if recommended_price > 0:
        if min_profit_rate > 0 and min_profit_rate < 1:
            rhs = Decimal(buy_cap_price + default_extra_cost_yen) / (Decimal("1") - min_profit_rate)
            required_by_rate = int(rhs.to_integral_value(rounding="ROUND_CEILING"))
        else:
            required_by_rate = 0

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
