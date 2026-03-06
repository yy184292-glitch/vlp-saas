from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

InvoiceType = Literal["invoice", "receipt"]
InvoiceBillingCycle = Literal["monthly", "yearly"]
InvoiceStatus = Literal["draft", "issued", "paid", "cancelled"]

# プラン料金マスタ（月額・年額）
PLAN_PRICES: dict[str, dict[str, int]] = {
    "starter":  {"monthly": 9_800,  "yearly": 105_840},
    "standard": {"monthly": 19_800, "yearly": 213_840},
    "pro":      {"monthly": 29_800, "yearly": 321_840},
}

TAX_RATE = 0.10


class LicenseInvoiceCreate(BaseModel):
    license_id: UUID
    type: InvoiceType = "invoice"
    billing_cycle: InvoiceBillingCycle = "monthly"
    amount: int = Field(..., ge=0)           # 税抜金額
    period_from: Optional[date] = None
    period_to: Optional[date] = None
    due_date: Optional[date] = None
    note: Optional[str] = None


class LicenseInvoiceOut(BaseModel):
    id: UUID
    store_id: UUID
    license_id: UUID
    store_name: str
    invoice_number: str
    type: InvoiceType
    billing_cycle: InvoiceBillingCycle
    amount: int
    tax_amount: int
    total_amount: int
    period_from: Optional[date]
    period_to: Optional[date]
    issued_at: Optional[datetime]
    due_date: Optional[date]
    paid_at: Optional[datetime]
    status: InvoiceStatus
    note: Optional[str]
    created_at: datetime
    updated_at: datetime
    # 表示用追加フィールド
    plan: str = ""

    model_config = {"from_attributes": True}
