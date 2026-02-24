from __future__ import annotations

import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db  # ✅ single source of truth
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)

from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse

# ★ stores モデルが無い場合は下の「store.py」も追加してください
from app.models.store import Store

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(data: UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(User).where(User.email == data.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # ------------------------------------------------------------
    # 1) 店舗を用意（運用として：初回登録ユーザーが店主=店舗作成）
    #   - 既に店舗がある場合は最初の1件を使う（暫定）
    #   - 本番は「店舗名」入力を追加するのが理想
    # ------------------------------------------------------------
    store = db.execute(select(Store).limit(1)).scalar_one_or_none()
    if store is None:
        store = Store(
            id=uuid.uuid4(),
            name="Default Store",
        )
        db.add(store)
        db.commit()
        db.refresh(store)

    # ------------------------------------------------------------
    # 2) ユーザー作成（store_id を必ず入れる）
    # ------------------------------------------------------------
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        store_id=store.id,
        role="admin",  # 初回登録はadmin扱い（運用上安全）
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.execute(
        select(User).where(User.email == data.email)
    ).scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))

    return {
        "access_token": token,
        "token_type": "bearer",
    }
