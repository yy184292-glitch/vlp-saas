from __future__ import annotations

from datetime import timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.store import StoreORM
from app.core.security import (
    verify_password,
    create_access_token,
    get_password_hash,
)

router = APIRouter(tags=["auth"])


# ============================================================
# schemas
# ============================================================

class LoginIn(BaseModel):
    email: str
    password: str


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    store_id: Optional[UUID]


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str
    store_id: Optional[UUID] = None


# ============================================================
# internal helpers
# ============================================================

def _get_user_password_hash(user: User) -> Optional[str]:
    """
    password_hash / hashed_password / password の揺れを吸収
    """
    for attr in ("password_hash", "hashed_password", "password"):
        if hasattr(user, attr):
            value = getattr(user, attr)
            if isinstance(value, str) and value:
                return value
    return None


def _set_user_password_hash(user: User, hashed: str) -> None:
    """
    存在する列に安全にセット
    """
    for attr in ("password_hash", "hashed_password"):
        if hasattr(user, attr):
            setattr(user, attr, hashed)
            return

    raise HTTPException(
        status_code=500,
        detail="User model has no password hash column",
    )


# ============================================================
# login
# ============================================================

@router.post("/auth/login", response_model=LoginOut)
def login(
    body: LoginIn,
    db: Session = Depends(get_db),
) -> LoginOut:

    user = db.execute(
        select(User).where(User.email == body.email)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_hash = _get_user_password_hash(user)

    if not stored_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # store check
    store_id = getattr(user, "store_id", None)

    if store_id:
        store = db.get(StoreORM, store_id)
        if not store:
            raise HTTPException(status_code=400, detail="Store not found")

    token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(hours=24),
    )

    return LoginOut(
        access_token=token,
        user_id=user.id,
        store_id=store_id,
    )


# ============================================================
# register
# ============================================================

@router.post("/auth/register")
def register(
    body: RegisterIn,
    db: Session = Depends(get_db),
):

    existing = db.execute(
        select(User).where(User.email == body.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already exists",
        )

    if body.store_id:
        store = db.get(StoreORM, body.store_id)
        if not store:
            raise HTTPException(
                status_code=400,
                detail="Store not found",
            )

    hashed = get_password_hash(body.password)

    user = User(
        email=body.email,
        store_id=body.store_id,
    )

    _set_user_password_hash(user, hashed)

    # name列が存在する場合のみセット（互換対応）
    if body.name:
        for attr in ("name", "full_name", "username"):
            if hasattr(user, attr):
                setattr(user, attr, body.name)
                break

    db.add(user)
    db.commit()

    return {"created": True}