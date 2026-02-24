# app/routes/cars.py (UUID対応 完全版)
from __future__ import annotations

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
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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


router = APIRouter(prefix="/cars", tags=["cars"])
security = HTTPBearer(auto_error=False)


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

    # UUIDとして解釈
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

import logging
from sqlalchemy.inspection import inspect
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

def _create_car_with_payload(
    db: Session,
    current_user: User,
    payload: Dict[str, Any],
) -> Car:

    payload = dict(payload)

    payload["user_id"] = current_user.id
    payload["store_id"] = current_user.store_id

    # --- normalize strings ---
    def _norm(v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v

    for k in list(payload.keys()):
        payload[k] = _norm(payload[k])

    # --- schema/UI -> DB mapping（make を必ず埋める：最重要）---
    # UIは maker を送ることが多い / schema内部は make になることもある
    if not payload.get("make"):
        payload["make"] = payload.get("maker")

    # 念のため別候補（将来の入力ゆれ耐性）
    if not payload.get("make"):
        payload["make"] = payload.get("manufacturer") or payload.get("車名") or payload.get("メーカー")

    # 互換用：maker も埋めたいなら（任意）
    if not payload.get("maker"):
        payload["maker"] = payload.get("make")

    # year_month -> first_registration（Carにあるなら）
    if payload.get("year_month") and not payload.get("first_registration"):
        payload["first_registration"] = payload.get("year_month")

    # inspection_expiry -> shaken_expiry（Carにあるなら）
    if payload.get("inspection_expiry") and not payload.get("shaken_expiry"):
        payload["shaken_expiry"] = payload.get("inspection_expiry")
    

    
    # --- filter to actual model columns ---
    mapper = inspect(Car)
    allowed_keys = {c.key for c in mapper.columns}

    dropped_keys = sorted(set(payload.keys()) - allowed_keys)
    if dropped_keys:
        logger.info("Dropped unsupported car fields: %s", dropped_keys)

    payload = {k: v for k, v in payload.items() if k in allowed_keys}

    # --- required fields based on DB constraints（Carモデルに合わせる）---
    required = ["stock_no", "maker", "model", "year"]
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
            detail=f"Failed to create car: {str(e)}",
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
    # pydantic v2
    payload = data.model_dump()

    # --- 強制マッピング（これで make が必ず入る）---
    # DBは make NOT NULL（Carモデル/DB側） :contentReference[oaicite:3]{index=3}
    if not payload.get("make"):
        # schemaは maker :contentReference[oaicite:4]{index=4}
        payload["make"] = getattr(data, "maker", None)

    # stock_no も念のため（payloadに無い事故を潰す）
    if not payload.get("stock_no"):
        payload["stock_no"] = getattr(data, "stock_no", None)

    # 最終防衛：ここで make が無ければ400（原因が一発で分かる）
    if not payload.get("make"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="maker (schema) was not received; cannot map to make (DB).",
        )

    return _create_car_with_payload(db, current_user, payload)

# =========================================================
# update
# =========================================================
@router.put("/{car_id}", response_model=CarRead)
def update_car(
    car_id: int,
    data: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    car = db.get(Car, car_id)

    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")

    if car.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(car, key, value)

    try:
        db.commit()
        db.refresh(car)
        return car

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Unique constraint failed",
        )


# =========================================================
# delete
# =========================================================
@router.delete("/{car_id}")
def delete_car(
    car_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    car = db.get(Car, car_id)

    if car is None:
        raise HTTPException(status_code=404)

    if car.user_id != current_user.id:
        raise HTTPException(status_code=403)

    db.delete(car)
    db.commit()

    return {"ok": True}
