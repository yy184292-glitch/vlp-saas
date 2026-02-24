from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.schemas.valuation import (
    ValuationRequest,
    ValuationResponse,
    ValuationSettingsRead,
    ValuationSettingsUpdate,
)
from app.services.valuation_service import (
    calculate_valuation,
    get_or_create_settings,
    update_settings,
)

router = APIRouter(prefix="/valuation", tags=["valuation"])


@router.get("/settings", response_model=ValuationSettingsRead)
def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    s = get_or_create_settings(db, current_user.store_id)
    return {
        "provider": s.provider,
        "display_adjust_pct": float(s.display_adjust_pct),
        "buy_cap_pct": float(s.buy_cap_pct),
        "recommended_from_cap_yen": int(s.recommended_from_cap_yen),
        "risk_buffer_yen": int(s.risk_buffer_yen),
        "round_unit_yen": int(s.round_unit_yen),
        "default_extra_cost_yen": int(s.default_extra_cost_yen),
        "min_profit_yen": int(s.min_profit_yen),
        "min_profit_rate": float(s.min_profit_rate),
    }


@router.put("/settings", response_model=ValuationSettingsRead)
def put_settings(
    body: ValuationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    s = update_settings(db, current_user.store_id, body.model_dump())
    return {
        "provider": s.provider,
        "display_adjust_pct": float(s.display_adjust_pct),
        "buy_cap_pct": float(s.buy_cap_pct),
        "recommended_from_cap_yen": int(s.recommended_from_cap_yen),
        "risk_buffer_yen": int(s.risk_buffer_yen),
        "round_unit_yen": int(s.round_unit_yen),
        "default_extra_cost_yen": int(s.default_extra_cost_yen),
        "min_profit_yen": int(s.min_profit_yen),
        "min_profit_rate": float(s.min_profit_rate),
    }


@router.post("/calculate", response_model=ValuationResponse)
def calculate(
    body: ValuationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return calculate_valuation(
        db=db,
        store_id=current_user.store_id,
        make=body.make,
        model=body.model,
        grade=body.grade,
        year=body.year,
        mileage=body.mileage,
    )
