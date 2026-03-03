from __future__ import annotations

from typing import Optional, Any
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


def _extract_sub(decoded: Any) -> Optional[str]:
    """
    decode_access_token の返り値が
    - "sub" 文字列
    - {"sub": "..."} を含む dict
    のどちらでも sub を取り出す。
    """
    if decoded is None:
        return None

    if isinstance(decoded, str):
        return decoded.strip() or None

    if isinstance(decoded, dict):
        sub = decoded.get("sub")
        if isinstance(sub, str):
            return sub.strip() or None
        return None

    # 想定外型
    return None


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

    decoded = decode_access_token(creds.credentials)
    sub = _extract_sub(decoded)
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
