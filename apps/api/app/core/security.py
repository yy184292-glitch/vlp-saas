from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Final, Optional, TypedDict

from jose import JWTError, jwt
from passlib.context import CryptContext

# ============================================================
# Settings (single source of truth)
# ============================================================
def _get_env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    return v if v not in (None, "") else default


SECRET_KEY: Final[str] = _get_env("SECRET_KEY", "CHANGE_THIS_TO_RANDOM_SECRET")  # Renderで必ずSECRET_KEYを設定する
ALGORITHM: Final[str] = _get_env("JWT_ALGORITHM", "HS256") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: Final[int] = int(
    _get_env("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)) or str(60 * 24 * 7)
)

# ============================================================
# Password hashing
# ============================================================
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    if not isinstance(password, str) or not password:
        raise ValueError("Password cannot be empty")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


class TokenPayload(TypedDict):
    sub: str
    exp: int
    iat: int
    type: str


def create_access_token(subject: str) -> str:
    if not subject:
        raise ValueError("Subject cannot be empty")

    now = datetime.now(timezone.utc)
    payload: TokenPayload = {
        "sub": subject,
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "iat": int(now.timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    if not token:
        return None
    try:
        payload: Dict[str, Any] = jwt.decode(token, key=SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            return None
        if payload.get("type") not in (None, "access"):
            return None
        return sub
    except JWTError:
        return None
    except Exception:
        return None
