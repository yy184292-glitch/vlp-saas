from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InstructionOrderORM(Base):
    """指示書（期限管理用）

    引継ぎメモ仕様：
    - received_at: 入庫日
    - due_at: 期限日（必ずDB保存）
    - status: 進行状態
    """

    __tablename__ = "instruction_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 車両に紐付く場合に使用（任意）
    car_id = Column(UUID(as_uuid=True), ForeignKey("cars.id", ondelete="SET NULL"), nullable=True, index=True)

    received_at = Column(DateTime(timezone=True), nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # pending / in_progress / done / cancelled など
    status = Column(String, nullable=False, server_default="in_progress")

    memo = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_instruction_orders_store_due", "store_id", "due_at"),
        Index("ix_instruction_orders_store_received", "store_id", "received_at"),
    )
