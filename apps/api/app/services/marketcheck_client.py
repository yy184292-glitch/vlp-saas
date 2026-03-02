from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class MarketCheckError(RuntimeError):
    """MarketCheck API failure (network/timeout/schema/credentials)."""


@dataclass(frozen=True)
class MarketCheckPriceStats:
    """
    Subset of MarketCheck `stats.price` payload.
    We intentionally keep it minimal and defensive against schema changes.
    """
    count: int
    mean: Optional[float]
    median: Optional[float]
    min: Optional[float]
    max: Optional[float]


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _safe_int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def fetch_price_stats_active_search(
    *,
    api_key: str,
    make: str,
    model: str,
    year: int,
    zip_code: str,
    radius_miles: int = 200,
    car_type: str = "used",
    miles_range: Optional[str] = None,
    timeout_sec: float = 10.0,
) -> MarketCheckPriceStats:
    """
    MarketCheck Car Search API (active listings) with `stats=price`.

    We call it with `rows=0` to fetch only aggregates.

    Endpoint:
      GET https://api.marketcheck.com/v2/search/car/active
    """
    if not api_key:
        raise MarketCheckError("MARKETCHECK_API_KEY is not configured")
    if not make or not model or not year:
        raise MarketCheckError("make/model/year are required")
    if not zip_code:
        raise MarketCheckError("zip_code is required for spatial search")

    params: dict[str, Any] = {
        "api_key": api_key,
        "make": make,
        "model": model,
        "year": year,
        "car_type": car_type,
        "zip": zip_code,
        "radius": radius_miles,
        "rows": 0,
        "stats": "price",
    }
    if miles_range:
        # e.g. "30000-50000"
        params["miles_range"] = miles_range

    url = "https://api.marketcheck.com/v2/search/car/active"
    headers = {"Accept": "application/json"}

    try:
        with httpx.Client(timeout=timeout_sec, headers=headers) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except httpx.TimeoutException as e:
        raise MarketCheckError("MarketCheck timeout") from e
    except httpx.HTTPStatusError as e:
        # Avoid leaking sensitive params (api_key) in error text
        logger.warning("MarketCheck http error: %s", e.response.status_code, exc_info=True)
        raise MarketCheckError(f"MarketCheck http error: {e.response.status_code}") from e
    except Exception as e:
        logger.warning("MarketCheck request failed", exc_info=True)
        raise MarketCheckError("MarketCheck request failed") from e

    stats = (data or {}).get("stats") or {}
    price = stats.get("price") or {}
    percentiles = price.get("percentiles") or {}

    return MarketCheckPriceStats(
        count=_safe_int(price.get("count")),
        mean=_safe_float(price.get("mean")),
        median=_safe_float(price.get("median") or percentiles.get("50")),
        min=_safe_float(price.get("min")),
        max=_safe_float(price.get("max")),
    )
