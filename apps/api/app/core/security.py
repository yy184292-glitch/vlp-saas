from __future__ import annotations

"""
security.py

JWT認証・パスワードハッシュ管理モジュール

特徴:
- 型安全
- 例外安全
- FastAPI依存注入と互換
- Windows環境でも安定（pbkdf2_sha256使用）
- JWT検証を厳密化
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Final, TypedDict, Any, Dict

from jose import jwt, JWTError
from passlib.context import CryptContext


# =========================
# 設定（本番では環境変数/Settingsから読む）
# =========================

def _get_env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    return v if v not in (None, "") else default


def _load_secret_key() -> str:
    """SECRET_KEY を settings / env から取得（どちらも無ければ開発用デフォルト）"""
    # 1) settings から（存在するなら）
    try:
        from app.core.config import settings  # type: ignore
        v = getattr(settings, "SECRET_KEY", None)
        if isinstance(v, str) and v:
            return v
    except Exception:
        pass

    # 2) env から
    v = _get_env("SECRET_KEY")
    if v:
        return v

    # 3) フォールバック（開発用）
    return "CHANGE_THIS_TO_RANDOM_SECRET"


SECRET_KEY: Final[str] = _load_secret_key()
ALGORITHM: Final[str] = _get_env("JWT_ALGORITHM", "HS256") or "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: Final[int] = int(_get_env("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)) or str(60 * 24 * 7))


# =========================
# パスワードハッシュ
# =========================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    """
    パスワードを安全にハッシュ化
    """
    if not isinstance(password, str) or not password:
        raise ValueError("Password cannot be empty")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    パスワード検証
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


class TokenPayload(TypedDict):
    sub: str
    exp: int  # UNIX timestamp
    iat: int  # UNIX timestamp
    type: str


# =========================
# JWT作成
# =========================

def create_access_token(subject: str) -> str:
    """
    JWTアクセストークン生成

    Args:
        subject: user_id（文字列）

    Returns:
        JWT文字列
    """
    if not subject:
        raise ValueError("Subject cannot be empty")

    now = datetime.now(timezone.utc)

    exp_ts = int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp())
    iat_ts = int(now.timestamp())

    payload: TokenPayload = {
        "sub": subject,
        "exp": exp_ts,
        "iat": iat_ts,
        "type": "access",
    }

    token: str = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token


# =========================
# JWT検証
# =========================

def decode_access_token(token: str) -> Optional[str]:
    """
    JWT検証

    Args:
        token: JWT文字列

    Returns:
        user_id (sub) または None
    """
    if not token:
        return None

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            key=SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        if not isinstance(payload, dict):
            return None

        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            return None

        # 追加の型チェック（任意）
        token_type = payload.get("type")
        if token_type is not None and token_type != "access":
            return None

        return subject

    except JWTError:
        return None
    except Exception:
        return None
