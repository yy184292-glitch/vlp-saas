from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoreSettingORM(Base):
    """店舗設定（店舗ごと）

    - tax_rate: 消費税率（例 0.10）
    - auto_expense_on_stock_in: 在庫入庫時に経費（部材）を自動計上する
    """

    __tablename__ = "store_settings"

    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)

    tax_rate = Column(Numeric(5, 4), nullable=False, server_default="0.10")
    auto_expense_on_stock_in = Column(Boolean, nullable=False, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_store_settings_store_id", "store_id"),
    )
