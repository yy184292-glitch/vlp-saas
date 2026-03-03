from __future__ import annotations

from typing import Optional, Any
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

security = HTTPBearer(auto_error=True)


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
    のどちらでも user_id を取り出す。
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

    return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Bearer JWT を検証し、User を返す。
    """
    token = credentials.credentials
    decoded = decode_access_token(token)
    sub = _extract_sub(decoded)
    if not sub:
        raise _unauthorized("Invalid token")

    try:
        user_uuid = UUID(sub)
    except Exception:
        raise _unauthorized("Invalid token")

    user = db.get(User, user_uuid)
    if user is None:
        raise _unauthorized("User not found")

    return user
