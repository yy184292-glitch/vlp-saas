from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoreORM(Base):
    __tablename__ = "stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    name = Column(String(255), nullable=False)

    postal_code = Column(String(16), nullable=True)
    address1 = Column(String(255), nullable=True)
    address2 = Column(String(255), nullable=True)
    tel = Column(String(32), nullable=True)
    email = Column(String(255), nullable=True)

    # 適格請求書発行事業者番号（例: T1234567890123）
    invoice_number = Column(String(32), nullable=True)

    # 振込先
    bank_name = Column(String(64), nullable=True)
    bank_branch = Column(String(64), nullable=True)
    bank_account_type = Column(String(16), nullable=True)  # 普通 / 当座 等（自由入力）
    bank_account_number = Column(String(32), nullable=True)
    bank_account_holder = Column(String(128), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)