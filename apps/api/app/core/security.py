from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

# ============================================================
# Password hashing
# ============================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt has a 72-byte input limit (bytes, not characters).
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_secret(password: str) -> bytes:
    """
    bcrypt仕様に合わせて「72バイト以下のbytes」を必ず返す。
    passlib 側の "truncate manually" 系エラーを確実に回避するため、
    hash/verify ともに bytes を渡す運用に寄せる。
    """
    if not isinstance(password, str):
        raise ValueError("password must be a string")
    if not password:
        raise ValueError("password must be a non-empty string")

    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) <= _BCRYPT_MAX_BYTES:
        return pw_bytes
    return pw_bytes[:_BCRYPT_MAX_BYTES]


def get_password_hash(password: str) -> str:
    secret = _to_bcrypt_secret(password)

    # passlib/bcrypt の実装差で例外になるのを避けるため、
    # ここでは「常に 72 bytes 以下の bytes」を渡す。
    try:
        return pwd_context.hash(secret)
    except Exception as e:
        # もしバックエンド差異でここに来ても、secret は <=72 なので再試行しても同じ。
        # 原因特定しやすいよう、そのまま投げる。
        raise e


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False

    try:
        secret = _to_bcrypt_secret(plain_password)
        return pwd_context.verify(secret, hashed_password)
    except Exception:
        return False


# ============================================================
# JWT
# ============================================================

def _get_secret_key() -> str:
    """
    本番は環境変数 SECRET_KEY を必須にしたいが、
    まずローカルで動かすためにフォールバックを用意。
    """
    try:
        from app.core.settings import settings  # type: ignore
        key = getattr(settings, "SECRET_KEY", None)
        if isinstance(key, str) and key.strip():
            return key.strip()
    except Exception:
        pass

    key = os.getenv("SECRET_KEY", "").strip()
    if key:
        return key

    # DEV fallback（本番では必ず env 設定すること）
    return "DEV_ONLY_INSECURE_SECRET_KEY_CHANGE_ME"


def _get_algorithm() -> str:
    try:
        from app.core.settings import settings  # type: ignore
        alg = getattr(settings, "ALGORITHM", None)
        if isinstance(alg, str) and alg.strip():
            return alg.strip()
    except Exception:
        pass
    return os.getenv("ALGORITHM", "HS256").strip() or "HS256"


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    if not subject:
        raise ValueError("subject is required")

    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=24))

    to_encode: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    secret_key = _get_secret_key()
    algorithm = _get_algorithm()
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    必要なら users/me 等で使えるように用意。
    """
    secret_key = _get_secret_key()
    algorithm = _get_algorithm()
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        if not isinstance(payload, dict):
            raise JWTError("invalid payload")
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}") from e


# ============================================================
# Backward-compatible aliases
# ============================================================

def decode_access_token(token: str) -> dict:
    """
    既存コード互換: dependencies/auth.py などが期待する関数名。
    """
    return decode_token(token)
