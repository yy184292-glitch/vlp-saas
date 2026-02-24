# app/routes/cars.py
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.car import Car
from app.models.user import User
from app.schemas.car import CarCreate, CarRead, CarUpdate
from app.services.valuation_service import calculate_valuation

# ↓↓↓ ここはあなたの既存実装に合わせて調整が必要な場合あり ↓↓↓
# 「decode_access_token」がある場所に合わせる。
# もし app.core.security に無いなら、あなたのプロジェクトにある実際の場所へ変更。
from app.core.security import decode_access_token
# ↑↑↑

router = APIRouter(prefix="/cars", tags=["cars"])
security = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)


# =========================
# Current User Dependency (UUID対応)
# =========================
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )

    token: str = credentials.credentials

    # decode_access_token は「user_id(文字列)」を返す想定
    user_id_str: Optional[str] = decode_access_token(token)
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    try:
        user_id = UUID(user_id_str)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    user: Optional[User] = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


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
