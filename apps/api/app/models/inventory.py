# app/models/inventory.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InventoryItemORM(Base):
    """
    在庫品マスタ（部材/商品）

    - store_id: 店舗単位
    - sku: 管理コード（任意）
    - name: 品名
    - unit: 単位（例: L / 個）
    - cost_price: 原価単価（仕入単価）
    - sale_price: 販売単価（任意：部材を単体販売する場合）
    - qty_on_hand: 現在庫（簡易方式：台帳と併用。将来は台帳集計へ寄せてもOK）
    """

    __tablename__ = "inventory_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sku = Column(String(64), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    unit = Column(String(32), nullable=True)

    cost_price = Column(Numeric(12, 4), nullable=False, default=Decimal("0"))
    sale_price = Column(Numeric(12, 4), nullable=False, default=Decimal("0"))

    # まずは「現在庫カラム」を持つ簡易方式で開始（台帳も同時に記録）
    qty_on_hand = Column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    store = relationship("StoreORM", lazy="selectin")

    __table_args__ = (
        Index("ix_inventory_items_store_name", "store_id", "name"),
        Index("ix_inventory_items_store_sku", "store_id", "sku"),
    )


class StockMoveORM(Base):
    """
    在庫移動台帳（入出庫・消費・棚卸調整）

    move_type:
      - in     : 入庫（仕入、返品戻し等）
      - out    : 出庫（販売、作業での消費等）
      - adjust : 棚卸調整（増減）
    """

    __tablename__ = "stock_moves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    move_type = Column(String(16), nullable=False, index=True)  # in/out/adjust

    # 増減量（out はマイナスにしない。符号は move_type で解釈）
    qty = Column(Numeric(14, 4), nullable=False, default=Decimal("0"))

    # この移動の単価（原価）をスナップショットで保持
    unit_cost = Column(Numeric(12, 4), nullable=False, default=Decimal("0"))

    # 任意の参照（請求/作業指示など）
    ref_type = Column(String(32), nullable=True, index=True)  # billing / work_order / manual ...
    ref_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    item = relationship("InventoryItemORM", lazy="selectin")
    store = relationship("StoreORM", lazy="selectin")

    __table_args__ = (
        Index("ix_stock_moves_store_item_created", "store_id", "item_id", "created_at"),
        Index("ix_stock_moves_ref", "ref_type", "ref_id"),
    )