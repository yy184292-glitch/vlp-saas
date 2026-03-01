# app/models/work_material.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Index, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkMaterialORM(Base):
    """
    作業マスタ(BOM): Work に対して必要な在庫品(InventoryItem)と数量を定義する。

    例:
      Work: オイル交換
        - オイル 0W-20  4.0 L
        - オイルフィルタ 1 個

    qty_per_work: 1回の作業で消費する数量（在庫単位と合わせる）
    """

    __tablename__ = "work_materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    work_id = Column(
        UUID(as_uuid=True),
        ForeignKey("works.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    qty_per_work = Column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # relations
    work = relationship("WorkORM", lazy="selectin")
    item = relationship("InventoryItemORM", lazy="selectin")
    store = relationship("StoreORM", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("work_id", "item_id", name="uq_work_materials_work_item"),
        Index("ix_work_materials_store_work", "store_id", "work_id"),
        Index("ix_work_materials_store_item", "store_id", "item_id"),
    )