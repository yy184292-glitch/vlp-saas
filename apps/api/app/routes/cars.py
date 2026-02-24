# app/routes/cars.py
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

# ✅ これに統一（自前 get_current_user は作らない）
from app.api.deps import get_current_user

from app.db.session import get_db
from app.models.car import Car
from app.models.user import User
from app.schemas.car import CarCreate, CarRead, CarUpdate

# OCR import
from app.services.shaken_ocr import (
    OcrConfig,
    ShakenOcrError,
    ocr_text_from_file_bytes,
    parse_shaken_text_to_json,
)

# valuation import
from app.services.valuation_service import calculate_valuation

router = APIRouter(prefix="/cars", tags=["cars"])
security = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)


# =========================================================
# Internal helpers
# =========================================================
def _create_car_with_payload(
    db: Session,
    current_user: User,
    payload: Dict[str, Any],
) -> Car:
    payload = dict(payload)

    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)

    payload["user_id"] = current_user.id
    payload["store_id"] = current_user.store_id

    def _norm(v: Any) -> Any:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v

    for k in list(payload.keys()):
        payload[k] = _norm(payload[k])

    if not payload.get("make"):
        payload["make"] = payload.get("maker")

    if not payload.get("make"):
        payload["make"] = payload.get("manufacturer") or payload.get("車名") or payload.get("メーカー")

    if not payload.get("maker"):
        payload["maker"] = payload.get("make")

    mapper = inspect(Car)
    allowed_keys = {c.key for c in mapper.columns}

    dropped_keys = sorted(set(payload.keys()) - allowed_keys)
    if dropped_keys:
        logger.info("Dropped unsupported car fields: %s", dropped_keys)

    payload = {k: v for k, v in payload.items() if k in allowed_keys}

    required = ["stock_no", "make", "model", "year"]
    missing = [k for k in required if payload.get(k) in (None, "")]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required fields: {missing}",
        )

    try:
        car = Car(**payload)
        db.add(car)
        db.commit()
        db.refresh(car)
        return car
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Integrity error: {str(e.orig)}",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create car: {type(e).__name__}: {str(e)}",
        )


# =========================================================
# Schemas
# =========================================================
class CarFromShakenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    shaken: Dict[str, Any]
    stock_no: Optional[str] = None


# =========================================================
# Standard CRUD
# =========================================================
@router.post("", response_model=CarRead, status_code=status.HTTP_201_CREATED)
def create_car(
    data: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    return _create_car_with_payload(db, current_user, payload)


@router.post("/{car_id}/valuation", response_model=CarRead)
def save_valuation_to_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        car: Optional[Car] = db.get(Car, car_id)
        if car is None:
            raise HTTPException(status_code=404, detail="Car not found")

        if car.store_id != current_user.store_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        make = car.make or car.maker
        if not make or not car.model or not car.year:
            raise HTTPException(
                status_code=400,
                detail="Car is missing required fields for valuation (make/model/year).",
            )

        # ✅ calculate_valuation の仕様に合わせて引数を揃える :contentReference[oaicite:4]{index=4}
        result = calculate_valuation(
            db=db,
            store_id=current_user.store_id,
            make=make,
            model=car.model,
            grade=car.grade or "",
            year=int(car.year),
            mileage=int(car.mileage or 0),
        )

        car.expected_buy_price = result.get("buy_cap_price")
        car.expected_sell_price = result.get("recommended_price")
        car.expected_profit = result.get("expected_profit")
        car.expected_profit_rate = result.get("expected_profit_rate")
        car.valuation_at = datetime.now(timezone.utc)

        db.add(car)
        db.commit()
        db.refresh(car)
        return car

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"save_valuation_to_car failed: {type(e).__name__}: {str(e)}",
        )
