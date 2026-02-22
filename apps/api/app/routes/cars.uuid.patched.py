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
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.car import Car
from app.models.user import User
from app.schemas.car import CarCreate, CarRead, CarUpdate

from app.services.shaken_ocr import (
    OcrConfig,
    ShakenOcrError,
    ocr_text_from_file_bytes,
    parse_shaken_text_to_json,
)


router = APIRouter(prefix="/cars", tags=["cars"])
security = HTTPBearer(auto_error=False)


# =========================
# Current User Dependency (UUID対応版)
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

    # UUIDとして解釈（ここが修正ポイント）
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
# Standard CRUD
# =========================================================
@router.get("", response_model=List[CarRead])
def list_cars(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Car).where(Car.user_id == current_user.id)
    return list(db.scalars(stmt).all())
