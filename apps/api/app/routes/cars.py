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

from app.api.deps import get_current_user

from app.core.security import decode_access_token
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

# valuation import（ここは既存に合わせる）
from app.services.valuation_service import calculate_valuation


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
    user_id_str: Optional[str] = decode_access_token(token)

    if user_id_str is None:
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
# Internal helpers
# =========================================================
def _create_car_with_payload(
    db: Session,
    current_user: User,
    payload: Dict[str, Any],
) -> Car:
    payload = dict(payload)

    # クライアントが送っても無視（サーバ側で決まる）
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

    # make を必ず埋める（DB必須）
    if not payload.get("make"):
        payload["make"] = payload.get("maker")

    if not payload.get("make"):
        payload["make"] = payload.get("manufacturer") or payload.get("車名") or payload.get("メーカー")

    # 互換用に maker も埋める
    if not payload.get("maker"):
        payload["maker"] = payload.get("make")

    mapper = inspect(Car)
    allowed_keys = {c.key for c in mapper.columns}

    dropped_keys = sorted(set(payload.keys()) - allowed_keys)
    if dropped_keys:
        logger.info("Dropped unsupported car fields: %s", dropped_keys)

    payload = {k: v for k, v in payload.items() if k in allowed_keys}

    # DB制約に合わせる（make が必須）
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


def _map_shaken_to_carcreate(shaken: Dict[str, Any]) -> Dict[str, Any]:
    mapping: Dict[str, List[str]] = {
        "vin": ["vin", "vehicle_id_number", "車台番号", "chassis_number"],
        "plate_no": ["plate_no", "registration_number", "登録番号", "ナンバー"],
        "maker": ["maker", "manufacturer", "車名", "メーカー"],
        "car_name": ["car_name", "model_name", "車種", "名称"],
        "model_code": ["model_code", "型式", "model_type"],
        "engine_code": ["engine_code", "原動機型式", "engine_model"],
        "mileage": ["mileage", "odometer", "走行距離", "distance_km"],
        "first_registration_date": ["first_registration_date", "初度登録年月"],
        "shaken_expire_date": ["shaken_expire_date", "inspection_expiry", "有効期間満了日"],
        "color": ["color", "カラー", "body_color"],
        "fuel_type": ["fuel_type", "燃料"],
        "transmission": ["transmission", "ミッション"],
    }

    allowed_fields = set(CarCreate.model_fields.keys())
    out: Dict[str, Any] = {}

    for car_field, candidates in mapping.items():
        if car_field not in allowed_fields:
            continue
        for key in candidates:
            if key in shaken and shaken[key] not in (None, ""):
                out[car_field] = shaken[key]
                break

    for key, value in shaken.items():
        if key in allowed_fields and key not in out and value not in (None, ""):
            out[key] = value

    return out


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

        req = {
            "make": make,
            "model": car.model,
            "grade": car.grade or "",
            "year": int(car.year),
            "mileage": int(car.mileage or 0),
        }

        result = calculate_valuation(db=db, current_user=current_user, payload=req)

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


@router.put("/{car_id}", response_model=CarRead)
def update_car(
    car_id: UUID,
    data: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = db.get(Car, car_id)
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
        raise HTTPException(status_code=400, detail=f"Integrity error: {str(e.orig)}")


@router.delete("/{car_id}")
def delete_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = db.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404)

    if car.store_id != current_user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(car)
    db.commit()
    return {"ok": True}
