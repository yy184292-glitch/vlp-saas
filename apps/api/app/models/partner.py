from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_partner_code(length: int = 8) -> str:
    """8文字英数字大文字のパートナーコードを生成（例: A3B2C4D5）。"""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class PartnerORM(Base):
    __tablename__ = "partners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # 8文字英数字大文字（例: A3B2C4D5）- パートナー専用コード
    code = Column(String(16), nullable=False, unique=True, default=generate_partner_code)

    # パートナー表示名
    name = Column(String(255), nullable=False)

    # silver / gold / platinum
    rank = Column(String(16), nullable=False, server_default="silver")
    rank_updated_at = Column(DateTime(timezone=True), nullable=True)

    # own / partner / null（ローン・保険・保証の担当）
    loan_type = Column(String(16), nullable=True)
    insurance_type = Column(String(16), nullable=True)
    warranty_type = Column(String(16), nullable=True)

    is_active = Column(Boolean(), nullable=False, server_default="true", default=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default="NOW()"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default="NOW()",
        onupdate=_utcnow,
    )
