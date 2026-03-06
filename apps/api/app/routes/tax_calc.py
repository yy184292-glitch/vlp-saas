"""自賠責・重量税計算 API"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.tax_calculator import (
    VEHICLE_TYPE_LABELS,
    ECO_TYPE_LABELS,
    calculate,
)

router = APIRouter(prefix="/tax", tags=["tax"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class TaxCalcRequest(BaseModel):
    vehicle_type: str = Field(..., description="passenger/kei/kei_business/bike_small/moped")
    weight_kg: float = Field(..., ge=0, description="車両重量(kg)")
    first_reg_year: int = Field(..., ge=1950, le=2100)
    first_reg_month: int = Field(..., ge=1, le=12)
    eco_type: str = Field("non_eco", description="non_eco/exempt/eco_75/eco_50/eco_25")
    jibaiseki_months: int = Field(25, description="自賠責加入期間(月)")
    inspection_years: int = Field(2, ge=1, le=2, description="車検期間(1 or 2年)")


class TaxCalcResponse(BaseModel):
    jibaiseki: int
    jyuryozei: int
    total: int
    vehicle_age: int
    age_category: str
    notes: List[str]


class VehicleTypeItem(BaseModel):
    value: str
    label: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/calculate", response_model=TaxCalcResponse)
def calculate_tax(body: TaxCalcRequest) -> TaxCalcResponse:
    result = calculate(
        vehicle_type=body.vehicle_type,
        weight_kg=body.weight_kg,
        first_reg_year=body.first_reg_year,
        first_reg_month=body.first_reg_month,
        eco_type=body.eco_type,
        jibaiseki_months=body.jibaiseki_months,
        inspection_years=body.inspection_years,
    )
    return TaxCalcResponse(**result)


@router.get("/vehicle-types", response_model=List[VehicleTypeItem])
def get_vehicle_types() -> List[VehicleTypeItem]:
    return [
        VehicleTypeItem(value=k, label=v)
        for k, v in VEHICLE_TYPE_LABELS.items()
    ]


@router.get("/eco-types", response_model=List[VehicleTypeItem])
def get_eco_types() -> List[VehicleTypeItem]:
    return [
        VehicleTypeItem(value=k, label=v)
        for k, v in ECO_TYPE_LABELS.items()
    ]
