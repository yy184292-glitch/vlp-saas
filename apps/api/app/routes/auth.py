from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db  # ✅ single source of truth
from app.models.store import Store
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin

router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_default_store(db: Session) -> Store:
    """
    Ensure there is at least one store.
    Race-safe-ish: handle concurrent creates by retrying read if commit fails.
    """
    store = db.execute(select(Store).limit(1)).scalar_one_or_none()
    if store is not None:
        return store

    store = Store(id=uuid.uuid4(), name="Default Store")
    db.add(store)
    try:
        db.commit()
        db.refresh(store)
        return store
    except IntegrityError:
        # Another request likely created it concurrently
        db.rollback()
        store = db.execute(select(Store).limit(1)).scalar_one()
        return store


def _is_first_user(db: Session) -> bool:
    # users が空なら初回
    count = db.execute(select(func.count()).select_from(User)).scalar_one()
    return int(count) == 0


@router.post("/register", response_model=TokenResponse)
def register(data: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == data.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    store = _ensure_default_store(db)

    # ✅ 初回のみ admin、2人目以降は user（公開環境の事故を軽減）
    role = "admin" if _is_first_user(db) else "user"

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        store_id=store.id,
        role=role,
    )

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        # email unique 制約がある前提で、競合時は同じエラーに寄せる
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered") from None

    token = create_access_token(str(user.id))
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.email == data.email)).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        # 認証失敗理由は揃える（ユーザー列挙を避ける）
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    return {"access_token": token, "token_type": "bearer"}
