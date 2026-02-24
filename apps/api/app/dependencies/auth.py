from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

# Authorization: Bearer <token>
bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Could not validate credentials") -> HTTPException:
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
    Single source of truth for authentication dependency.
    - Extract Bearer token from Authorization header
    - Verify JWT via app.core.security.decode_access_token
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
