# app/schemas/inventory.py
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


StockMoveType = Literal["in", "out", "adjust"]


# ============================================================
# InventoryItem
# ============================================================

class InventoryItemCreateIn(BaseModel):
    store_id: UUID

    sku: Optional[str] = Field(default=None, max_length=64)
    name: str = Field(..., max_length=255)
    unit: Optional[str] = Field(default=None, max_length=32)

    cost_price: Decimal = Field(default=Decimal("0"))
    sale_price: Decimal = Field(default=Decimal("0"))

    qty_on_hand: Decimal = Field(default=Decimal("0"))

    note: Optional[str] = None


class InventoryItemUpdateIn(BaseModel):
    sku: Optional[str] = Field(default=None, max_length=64)
    name: Optional[str] = Field(default=None, max_length=255)
    unit: Optional[str] = Field(default=None, max_length=32)

    cost_price: Optional[Decimal] = None
    sale_price: Optional[Decimal] = None

    qty_on_hand: Optional[Decimal] = None

    note: Optional[str] = None


class InventoryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID

    sku: Optional[str] = None
    name: str
    unit: Optional[str] = None

    cost_price: Decimal
    sale_price: Decimal

    qty_on_hand: Decimal

    note: Optional[str] = None

    created_at: datetime
    updated_at: datetime


# ============================================================
# StockMove
# ============================================================

class StockMoveCreateIn(BaseModel):
    """
    手動入出庫/棚卸調整用
    ref_type/ref_id は任意（請求発行や作業指示から発生する場合はサーバ側で埋めるのを推奨）
    """
    store_id: UUID
    item_id: UUID

    move_type: StockMoveType

    qty: Decimal = Field(..., gt=Decimal("0"))

    unit_cost: Optional[Decimal] = None

    ref_type: Optional[str] = Field(default=None, max_length=32)
    ref_id: Optional[UUID] = None

    note: Optional[str] = None


class StockMoveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID
    item_id: UUID

    move_type: StockMoveType
    qty: Decimal
    unit_cost: Decimal

    ref_type: Optional[str] = None
    ref_id: Optional[UUID] = None

    note: Optional[str] = None

    created_at: datetime