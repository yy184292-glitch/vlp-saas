from __future__ import annotations

from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User


def require_roles(*allowed: str):
    """ロール制御（API側で確実に遮断する）"""

    def _dep(user: User = Depends(get_current_user)) -> User:
        role = getattr(user, "role", None)
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )
        return user

    return _dep
