from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.schemas.valuation import ValuationRequest, ValuationResponse
from app.services.valuation_service import calculate_valuation

router = APIRouter(prefix="/valuation", tags=["valuation"])


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
