from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

# Bearerトークンを Authorization: Bearer <token> から取得
# auto_error=False にして自前で 401 を統一する
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Could not validate credentials") -> HTTPException:
    # RFC的に401は WWW-Authenticate を返すのが望ましい
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Authentication dependency (single source of truth).
    - Extract Bearer token
    - Verify JWT via core.security.decode_access_token
    - Load User by UUID
    """
    if creds is None or not creds.credentials:
        raise _unauthorized("Not authenticated")

    sub = decode_access_token(creds.credentials)
    if not sub:
        raise _unauthorized()

    try:
        user_id = UUID(sub)
    except Exception:
        raise _unauthorized()

    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized()

    return user
