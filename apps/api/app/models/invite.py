from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_invite_code(length: int = 10) -> str:
    """推測されにくい招待コードを生成（英数、視認性優先でURL-safe）"""
    # token_urlsafe は長さが概ね 4/3 倍になるので調整
    raw = secrets.token_urlsafe(max(8, length))
    # 記号を避けて読みやすく
    code = "".join([c for c in raw if c.isalnum()])[:length]
    return code.upper()


class StoreInviteORM(Base):
    __tablename__ = "store_invites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(32), nullable=False, unique=True, index=True)

    # 招待で作成するユーザーのロール（基本 staff）
    role = Column(String(50), nullable=False, server_default="staff")

    max_uses = Column(Integer, nullable=False, server_default="1")
    used_count = Column(Integer, nullable=False, server_default="0")

    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    store = relationship("StoreORM", lazy="selectin")
