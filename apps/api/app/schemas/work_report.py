from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ────────────────────────────────────────────
# WorkReportItem
# ────────────────────────────────────────────

class WorkReportItemOut(BaseModel):
    id: UUID
    report_id: UUID
    work_master_id: Optional[UUID]
    item_name: str
    item_type: str
    quantity: Decimal
    unit_price: Decimal
    duration_minutes: Optional[int]
    is_checked: bool
    checked_at: Optional[datetime]
    memo: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkReportItemCreate(BaseModel):
    work_master_id: Optional[UUID] = None
    item_name: str = Field(..., min_length=1, max_length=255)
    item_type: str = Field(default="work", pattern="^(work|material)$")
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=0)
    memo: Optional[str] = None
    sort_order: int = Field(default=0)


class WorkReportItemUpdate(BaseModel):
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    item_type: Optional[str] = Field(default=None, pattern="^(work|material)$")
    quantity: Optional[Decimal] = Field(default=None, ge=0)
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=0)
    is_checked: Optional[bool] = None
    memo: Optional[str] = None
    sort_order: Optional[int] = None


# ────────────────────────────────────────────
# Invoice
# ────────────────────────────────────────────

class InvoiceOut(BaseModel):
    id: UUID
    report_id: UUID
    invoice_type: str
    issue_date: date
    due_date: Optional[date]
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    invoice_type: str = Field(default="estimate", pattern="^(estimate|invoice)$")
    issue_date: date
    due_date: Optional[date] = None
    subtotal: Decimal = Field(default=Decimal("0"), ge=0)
    tax: Decimal = Field(default=Decimal("0"), ge=0)
    total: Decimal = Field(default=Decimal("0"), ge=0)
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    invoice_type: Optional[str] = Field(default=None, pattern="^(estimate|invoice)$")
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    subtotal: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    total: Optional[Decimal] = Field(default=None, ge=0)
    notes: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(draft|issued|paid|cancelled)$")


# ────────────────────────────────────────────
# WorkReport
# ────────────────────────────────────────────

class WorkReportOut(BaseModel):
    id: UUID
    instruction_id: Optional[UUID]
    car_id: Optional[UUID]
    store_id: UUID
    title: Optional[str]
    vehicle_category: Optional[str]
    status: str
    completed_at: Optional[datetime]
    reported_by: Optional[str]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    items: List[WorkReportItemOut] = []

    class Config:
        from_attributes = True


class WorkReportCreate(BaseModel):
    instruction_id: Optional[UUID] = None
    car_id: Optional[UUID] = None
    title: Optional[str] = Field(default=None, max_length=255)
    vehicle_category: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None
    items: List[WorkReportItemCreate] = []


class WorkReportUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    vehicle_category: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, pattern="^(in_progress|completed)$")
    reported_by: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class WorkReportComplete(BaseModel):
    reported_by: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None
