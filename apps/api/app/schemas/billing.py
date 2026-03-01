from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

BillingStatus = Literal["draft", "issued", "void"]
BillingKind = Literal["estimate", "invoice"]


class BillingLineIn(BaseModel):
    # NEW: 作業マスタ連動（任意）
    # work_id が指定されている場合、サーバ側で作業マスタから
    # name/unit/unit_price/cost_price をスナップショット確定する運用にする
    work_id: Optional[UUID] = None

    # 互換のため残す（work_id 未指定時はこれらがそのまま使われる）
    name: str
    qty: float = Field(default=0)
    unit: Optional[str] = None
    unit_price: Optional[int] = None
    cost_price: Optional[int] = None


class BillingCreateIn(BaseModel):
    kind: BillingKind = "invoice"
    status: BillingStatus = "draft"

    store_id: Optional[UUID] = None

    # NEW: 顧客マスタ紐付け（推奨）
    customer_id: Optional[UUID] = None

    # 旧/スナップショット用途（当面残す）
    customer_name: Optional[str] = None

    source_work_order_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None

    lines: list[BillingLineIn] = Field(default_factory=list)
    meta: Optional[dict[str, Any]] = None


class BillingUpdateIn(BaseModel):
    kind: Optional[BillingKind] = None
    status: Optional[BillingStatus] = None

    # 通常は token から決めるので API では更新させない運用でもOKだが、互換のため残す
    store_id: Optional[UUID] = None

    # NEW: 顧客マスタ紐付け
    customer_id: Optional[UUID] = None

    # 旧/スナップショット用途（当面残す）
    customer_name: Optional[str] = None

    source_work_order_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None

    lines: Optional[list[BillingLineIn]] = None
    meta: Optional[dict[str, Any]] = None


class BillingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: Optional[UUID] = None

    # NEW: 顧客マスタ紐付け
    customer_id: Optional[UUID] = None

    kind: BillingKind
    status: BillingStatus

    doc_no: Optional[str] = None

    # 旧/スナップショット用途（当面残す）
    customer_name: Optional[str] = None

    subtotal: int
    tax_total: int
    total: int

    tax_rate: Optional[Decimal] = None
    tax_mode: Optional[str] = None
    tax_rounding: Optional[str] = None

    issued_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class BillingLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    billing_id: UUID

    # NEW: 作業マスタ連動（任意）
    work_id: Optional[UUID] = None

    name: str
    qty: float
    unit: Optional[str]
    unit_price: int
    cost_price: int
    amount: int
    sort_order: int
    created_at: datetime


class BillingImportItemIn(BaseModel):
    id: str | None = None
    createdAt: str | None = None
    customerName: str | None = None
    total: int | None = None
    status: BillingStatus = "draft"
    kind: BillingKind = "invoice"
    lines: list[dict[str, Any]] = Field(default_factory=list)


class BillingImportIn(BaseModel):
    items: list[BillingImportItemIn] = Field(default_factory=list)


class BillingImportOut(BaseModel):
    inserted: int = 0


class BillingVoidIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=200)