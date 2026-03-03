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


def _truncate_to_bcrypt_limit(password: str) -> str:
    """
    bcryptの仕様に合わせて「72バイト」に揃える。
    - 72バイト超はbcrypt内部的に切り捨てられる（実装/ライブラリによっては例外）。
    - 運用上は、例外で落とすより「揃えて処理を継続」する方が事故が少ない。
    """
    if not isinstance(password, str):
        raise ValueError("password must be a string")

    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) <= _BCRYPT_MAX_BYTES:
        return password

    pw_bytes = pw_bytes[:_BCRYPT_MAX_BYTES]
    # マルチバイト文字の途中で切れた場合は末尾を捨てて復元
    return pw_bytes.decode("utf-8", errors="ignore")


def get_password_hash(password: str) -> str:
    if not isinstance(password, str) or not password:
        raise ValueError("password must be a non-empty string")

    pw = _truncate_to_bcrypt_limit(password)

    # passlib/bcrypt は入力が長いと例外を投げる場合があるので、
    # メッセージを見て安全に再試行する（運用で落とさない）
    try:
        return pwd_context.hash(pw)
    except Exception as e:
        msg = str(e).lower()
        if "72 bytes" in msg or "longer than 72" in msg:
            pw2 = _truncate_to_bcrypt_limit(pw)
            return pwd_context.hash(pw2)
        raise


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
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
    # settings があるなら優先して読む（無ければ env）
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
