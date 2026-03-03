from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.store_setting import StoreSettingORM
from app.models.user import User

router = APIRouter(tags=["settings"])


def _resolve_store_id(user: User, store_id: Optional[UUID]) -> UUID:
    if getattr(user, "store_id", None):
        return user.store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


class StoreSettingsOut(BaseModel):
    store_id: UUID
    tax_rate: Decimal
    auto_expense_on_stock_in: bool
    instruction_due_days: int

    invoice_due_rule_type: str
    invoice_due_days: int
    invoice_due_months: int

    class Config:
        from_attributes = True


class StoreSettingsUpdateIn(BaseModel):
    store_id: Optional[UUID] = None
    tax_rate: Optional[Decimal] = Field(default=None, ge=Decimal("0"), le=Decimal("1"))
    auto_expense_on_stock_in: Optional[bool] = None
    instruction_due_days: Optional[int] = Field(default=None, ge=0, le=365)

    invoice_due_months: Optional[int] = Field(default=None, ge=0, le=120)
    invoice_due_rule_type: Optional[str] = None  # "days" | "eom"
    invoice_due_days: Optional[int] = Field(default=None, ge=0, le=3650)

def _get_or_create(db: Session, store_id: UUID) -> StoreSettingORM:
    row = db.get(StoreSettingORM, store_id)
    if row:
        return row
    row = StoreSettingORM(store_id=store_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/settings/store", response_model=StoreSettingsOut)
def get_store_settings(
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoreSettingsOut:
    sid = _resolve_store_id(user, store_id)
    return _get_or_create(db, sid)


@router.put("/settings/store", response_model=StoreSettingsOut)
def update_store_settings(
    body: StoreSettingsUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoreSettingsOut:
    sid = _resolve_store_id(user, body.store_id)
    row = _get_or_create(db, sid)

    if body.tax_rate is not None:
        row.tax_rate = body.tax_rate
    if body.auto_expense_on_stock_in is not None:
        row.auto_expense_on_stock_in = body.auto_expense_on_stock_in
    if body.instruction_due_days is not None:
        row.instruction_due_days = int(body.instruction_due_days)


    if body.invoice_due_rule_type is not None:
        row.invoice_due_rule_type = body.invoice_due_rule_type
    if body.invoice_due_days is not None:
        row.invoice_due_days = int(body.invoice_due_days)
    if body.invoice_due_months is not None:
        row.invoice_due_months = int(body.invoice_due_months)

    db.add(row)
    db.commit()
    db.refresh(row)
    return row
