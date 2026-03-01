from __future__ import annotations

from fastapi import APIRouter, Depends

from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
):
    """ログインユーザー情報（UIの権限制御で使用）"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "store_id": str(current_user.store_id),
        "role": getattr(current_user, "role", "staff") or "staff",
    }
