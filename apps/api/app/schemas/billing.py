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
