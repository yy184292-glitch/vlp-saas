from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.store import StoreORM
from app.models.invite import StoreInviteORM
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
    role: str


class RegisterOwnerIn(BaseModel):
    """店舗オーナー（初期管理者）登録

    - 商用運用では「店舗作成 → 初期管理者登録」を管理画面側で行う想定。
    - 今は互換のため endpoint を残すが、store_id は必須。
    """
    email: str
    password: str
    name: str
    store_id: UUID


class RegisterInviteIn(BaseModel):
    """招待コードでのスタッフ登録"""
    invite_code: str = Field(..., min_length=6, max_length=32)
    email: str
    password: str
    name: str


# ============================================================
# internal helpers
# ============================================================

def _get_user_password_hash(user: User) -> Optional[str]:
    for attr in ("password_hash", "hashed_password", "password"):
        if hasattr(user, attr):
            value = getattr(user, attr)
            if isinstance(value, str) and value:
                return value
    return None


def _set_user_password_hash(user: User, hashed: str) -> None:
    for attr in ("password_hash", "hashed_password"):
        if hasattr(user, attr):
            setattr(user, attr, hashed)
            return
    raise HTTPException(status_code=500, detail="User model has no password hash column")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# login
# ============================================================

@router.post("/auth/login", response_model=LoginOut)
def login(
    body: LoginIn,
    db: Session = Depends(get_db),
) -> LoginOut:
    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    stored_hash = _get_user_password_hash(user)
    if not stored_hash or not verify_password(body.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # store exists check
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
        role=getattr(user, "role", "staff") or "staff",
    )


# ============================================================
# register (owner/admin)
# ============================================================

@router.post("/auth/register-owner")
def register_owner(
    body: RegisterOwnerIn,
    db: Session = Depends(get_db),
):
    existing = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    store = db.get(StoreORM, body.store_id)
    if not store:
        raise HTTPException(status_code=400, detail="Store not found")

    try:
        hashed = get_password_hash(body.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user = User(
        id=uuid4(),
        email=body.email,
        store_id=body.store_id,
        role="admin",
    )
    _set_user_password_hash(user, hashed)

    if body.name:
        for attr in ("name", "full_name", "username"):
            if hasattr(user, attr):
                setattr(user, attr, body.name)
                break

    db.add(user)
    db.commit()
    return {"created": True}


# ============================================================
# register with invite (staff/manager)
# ============================================================

@router.post("/auth/register-invite")
def register_with_invite(
    body: RegisterInviteIn,
    db: Session = Depends(get_db),
):
    existing = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    code = body.invite_code.strip().upper()

    inv = db.execute(select(StoreInviteORM).where(StoreInviteORM.code == code)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=400, detail="Invalid invite code")

    # expiry
    if inv.expires_at is not None and inv.expires_at < _utcnow():
        raise HTTPException(status_code=400, detail="Invite expired")

    # usage
    if int(inv.used_count or 0) >= int(inv.max_uses or 1):
        raise HTTPException(status_code=400, detail="Invite already used")

    store = db.get(StoreORM, inv.store_id)
    if not store:
        raise HTTPException(status_code=400, detail="Store not found")

    # seat limit check（商用の本命）
    seat_limit = int(getattr(store, "seat_limit", 5) or 5)
    active_users = db.execute(
        select(func.count()).select_from(User).where(User.store_id == inv.store_id, User.is_active == True)  # noqa: E712
    ).scalar_one()
    if int(active_users or 0) >= seat_limit:
        raise HTTPException(status_code=409, detail="Seat limit reached. Please upgrade plan.")

    try:
        hashed = get_password_hash(body.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    role = (inv.role or "staff").strip().lower()
    if role not in ("admin", "manager", "staff"):
        role = "staff"

    user = User(
        id=uuid4(),
        email=body.email,
        store_id=inv.store_id,
        role=role,
    )
    _set_user_password_hash(user, hashed)

    if body.name:
        for attr in ("name", "full_name", "username"):
            if hasattr(user, attr):
                setattr(user, attr, body.name)
                break

    # mark used
    inv.used_count = int(inv.used_count or 0) + 1
    inv.updated_at = _utcnow()

    db.add(user)
    db.add(inv)
    db.commit()
    return {"created": True}
