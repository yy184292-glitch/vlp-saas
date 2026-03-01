from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CustomerORM(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    name_kana = Column(String(255), nullable=True)  # ★追加（任意）
    honorific = Column(String(16), nullable=False, default="御中")

    postal_code = Column(String(16), nullable=True)
    address1 = Column(String(255), nullable=True)
    address2 = Column(String(255), nullable=True)
    tel = Column(String(32), nullable=True)
    email = Column(String(255), nullable=True)
    contact_person = Column(String(255), nullable=True)

    invoice_number = Column(String(32), nullable=True)  # ★追加（任意）
    payment_terms = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_customers_store_name", "store_id", "name"),
    )