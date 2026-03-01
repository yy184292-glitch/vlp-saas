from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Index
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExpenseSourceORM(Base):
    """経費の自動計上ソース紐付け（在庫入庫など）

    例:
    - source_type="stock_move"
    - source_id=<StockMoveORM.id>

    UNIQUE(source_type, source_id) により二重作成を防止
    """

    __tablename__ = "expense_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)

    source_type = Column(String(32), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    __table_args__ = (
        Index("ux_expense_sources_type_id", "source_type", "source_id", unique=True),
        Index("ix_expense_sources_store", "store_id"),
    )
