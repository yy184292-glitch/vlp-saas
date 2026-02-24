from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


def get_db():
    """
    DB session dependency.
    Note: Keep this local to the router module to avoid circular imports.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the authenticated user's basic info.
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        # store_id 等も必要ならここに追加（例: "store_id": str(current_user.store_id)）
    }
