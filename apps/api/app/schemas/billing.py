from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


BillingStatus = Literal["draft", "issued", "void"]
BillingKind = Literal["estimate", "invoice"]


class BillingLineIn(BaseModel):
    name: str
    qty: float = Field(default=0)
    unit: Optional[str] = None
    unit_price: Optional[int] = None
    cost_price: Optional[int] = None


class BillingCreateIn(BaseModel):
    kind: BillingKind = "invoice"
    status: BillingStatus = "draft"

    store_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    source_work_order_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None

    lines: list[BillingLineIn] = Field(default_factory=list)
    meta: Optional[dict[str, Any]] = None

class BillingUpdateIn(BaseModel):
    kind: Optional[BillingKind] = None
    status: Optional[BillingStatus] = None

    store_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    source_work_order_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None

    # 送られてきた場合のみ「明細を全置換」する
    lines: Optional[list[BillingLineIn]] = None
    meta: Optional[dict[str, Any]] = None



class BillingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: Optional[UUID] = None

    kind: str
    status: str

    customer_name: Optional[str] = None

    subtotal: int
    tax_total: int
    total: int

    issued_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime



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


class BillingLineOut(BaseModel):
    id: UUID
    billing_id: UUID
    name: str
    qty: float
    unit: Optional[str]
    unit_price: int
    cost_price: int
    amount: int
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True

class BillingImportOut(BaseModel):
    inserted: int = 0

