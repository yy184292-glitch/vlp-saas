from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.store import Store
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# =========================================================
# Helpers
# =========================================================

def _ensure_default_store(db: Session) -> Store:
    """
    Ensure at least one store exists.
    Safe against race conditions.
    """
    store = db.execute(select(Store).limit(1)).scalar_one_or_none()

    if store:
        return store

    store = Store(
        id=uuid.uuid4(),
        name="Default Store",
    )

    db.add(store)

    try:
        db.commit()
        db.refresh(store)
        return store

    except IntegrityError:
        db.rollback()
        # 別プロセスで作られた可能性
        store = db.execute(select(Store).limit(1)).scalar_one()
        return store


def _is_first_user(db: Session) -> bool:
    count = db.execute(select(func.count()).select_from(User)).scalar_one()
    return int(count) == 0


def _create_user(db: Session, email: str, password: str, store_id: uuid.UUID, role: str) -> User:
    """
    Create user with proper error handling.
    """
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        store_id=store_id,
        role=role,
        is_active=True,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
        return user

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        ) from None

    except Exception as e:
        db.rollback()
        logger.exception("User creation failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User creation failed: {type(e).__name__}",
        ) from None


# =========================================================
# Routes
# =========================================================

@router.post("/register", response_model=TokenResponse)
def register(
    data: UserCreate,
    db: Session = Depends(get_db),
):
    """
    Register new user.
    Automatically assigns to default store.
    """

    existing = db.execute(
        select(User).where(User.email == data.email)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    store = _ensure_default_store(db)

    role = "admin" if _is_first_user(db) else "user"

    user = _create_user(
        db=db,
        email=data.email,
        password=data.password,
        store_id=store.id,
        role=role,
    )

    token = create_access_token(str(user.id))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
    )


@router.post("/login", response_model=TokenResponse)
def login(
    data: UserLogin,
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT token.
    """

    user = db.execute(
        select(User).where(User.email == data.email)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    token = create_access_token(str(user.id))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
    )
