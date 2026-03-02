from __future__ import annotations

from pydantic import BaseModel, Field


class ValuationRequest(BaseModel):
    make: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    grade: str = Field(..., min_length=1)
    year: int = Field(..., ge=1950, le=2100)
    mileage: int = Field(..., ge=0)


class ValuationResponse(BaseModel):
    market_low: int
    market_median: int
    market_high: int
    buy_cap_price: int
    recommended_price: int
    expected_profit: int
    expected_profit_rate: float


class ValuationSettingsRead(BaseModel):
    provider: str
    market_zip: str
    market_radius_miles: int
    market_miles_band: int
    market_car_type: str
    market_currency: str
    market_fx_rate: float
    display_adjust_pct: float
    buy_cap_pct: float
    recommended_from_cap_yen: int
    risk_buffer_yen: int
    round_unit_yen: int
    default_extra_cost_yen: int
    min_profit_yen: int
    min_profit_rate: float


class ValuationSettingsUpdate(BaseModel):
    provider: str | None = None
    market_zip: str | None = None
    market_radius_miles: int | None = None
    market_miles_band: int | None = None
    market_car_type: str | None = None
    market_currency: str | None = None
    market_fx_rate: float | None = None
    display_adjust_pct: float | None = None
    buy_cap_pct: float | None = None
    recommended_from_cap_yen: int | None = None
    risk_buffer_yen: int | None = None
    round_unit_yen: int | None = None
    default_extra_cost_yen: int | None = None
    min_profit_yen: int | None = None
    min_profit_rate: float | None = None
