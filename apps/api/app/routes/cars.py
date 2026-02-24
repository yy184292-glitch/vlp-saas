# apps/api/app/routes/cars.py
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user  # ★ここが正解（検出済み）
from app.models.car import Car
from app.models.user import User
from app.schemas.car import CarCreate, CarRead, CarUpdate
from app.services.valuation_service import calculate_valuation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cars", tags=["cars"])


# =========================================================
# Internal helpers
# =========================================================
def _create_car_with_payload(db: Session, current_user: User, payload: Dict[str, Any]) -> Car:
    """
    CarCreate の payload を受け取り、DBモデルに合わせて整形して作成する。
    store_id / user_id は必ずサーバ側で付与する（テナント分離）。
    """
    payload = dict(payload)

    # サーバ管理項目は無視
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

    # make/maker 揺れ吸収（DB要件に合わせる）
    if not payload.get("make"):
        payload["make"] = payload.get("maker")
    if not payload.get("maker"):
        payload["maker"] = payload.get("make")

    # モデルのカラムのみ許可
    mapper = inspect(Car)
    allowed_keys = {c.key for c in mapper.columns}
    payload = {k: v for k, v in payload.items() if k in allowed_keys}

    # 最低限チェック（引き継ぎメモの cars 成功条件に合わせる）
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
        ) from None
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create car")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create car: {type(e).__name__}: {str(e)}",
        ) from None


# =========================================================
# CRUD
# =========================================================
@router.post("", response_model=CarRead, status_code=status.HTTP_201_CREATED)
def create_car(
    data: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    return _create_car_with_payload(db, current_user, payload)


@router.put("/{car_id}", response_model=CarRead)
def update_car(
    car_id: UUID,
    data: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car: Optional[Car] = db.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    if car.store_id != current_user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(car, key, value)

    try:
        db.commit()
        db.refresh(car)
        return car
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Integrity error: {str(e.orig)}") from None


@router.delete("/{car_id}")
def delete_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car: Optional[Car] = db.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    if car.store_id != current_user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(car)
    db.commit()
    return {"ok": True}


# =========================================================
# Valuation Save (最優先タスク)
# =========================================================
@router.post("/{car_id}/valuation", response_model=CarRead)
def save_valuation_to_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    査定を計算して cars に保存する。
    calculate_valuation は store_id を引数で受け取る設計なので current_user は渡さない。:contentReference[oaicite:2]{index=2}
    """
    try:
        car: Optional[Car] = db.get(Car, car_id)
        if car is None:
            raise HTTPException(status_code=404, detail="Car not found")
        if car.store_id != current_user.store_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        make = getattr(car, "make", None) or getattr(car, "maker", None)
        model = getattr(car, "model", None)
        year = getattr(car, "year", None)

        if not make or not model or not year:
            raise HTTPException(
                status_code=400,
                detail="Car is missing required fields for valuation (make/model/year).",
            )

        result = calculate_valuation(
            db=db,
            store_id=current_user.store_id,
            make=str(make),
            model=str(model),
            grade=str(getattr(car, "grade", "") or ""),
            year=int(year),
            mileage=int(getattr(car, "mileage", 0) or 0),
        )

        car.expected_buy_price = int(result["buy_cap_price"])
        car.expected_sell_price = int(result["recommended_price"])
        car.expected_profit = int(result["expected_profit"])
        car.expected_profit_rate = float(result["expected_profit_rate"])
        car.valuation_at = datetime.now(timezone.utc)

        db.add(car)
        db.commit()
        db.refresh(car)
        return car

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("save_valuation_to_car failed")
        raise HTTPException(
            status_code=500,
            detail=f"save_valuation_to_car failed: {type(e).__name__}: {str(e)}",
        ) from None
