from __future__ import annotations

from fastapi import Depends, Request

from app.dependencies.auth import get_current_user
from app.models.user import User


def attach_current_user(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    """request.state.user を既存コード互換でセットする"""
    request.state.user = user
    return user
