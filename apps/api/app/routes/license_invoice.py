from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user
from app.dependencies.permissions import require_roles
from app.models.license import LicenseORM
from app.models.license_invoice import LicenseInvoiceORM
from app.models.store import StoreORM
from app.schemas.license_invoice import (
    LicenseInvoiceCreate,
    LicenseInvoiceOut,
    TAX_RATE,
)

router = APIRouter(
    prefix="/admin/license-invoices",
    tags=["license-invoices"],
    dependencies=[Depends(attach_current_user), Depends(require_roles("superadmin"))],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _next_invoice_number(db: Session) -> str:
    """INV-YYYY-NNNN 形式の連番を生成する（同年内でリセットしない通番）。"""
    year = datetime.now(timezone.utc).year
    count = db.execute(
        select(func.count()).select_from(LicenseInvoiceORM).where(
            extract("year", LicenseInvoiceORM.created_at) == year
        )
    ).scalar_one()
    return f"INV-{year}-{count + 1:04d}"


def _to_out(inv: LicenseInvoiceORM, store_name: str, plan: str) -> LicenseInvoiceOut:
    return LicenseInvoiceOut(
        id=inv.id,
        store_id=inv.store_id,
        license_id=inv.license_id,
        store_name=store_name,
        invoice_number=inv.invoice_number,
        type=inv.type,          # type: ignore[arg-type]
        billing_cycle=inv.billing_cycle,  # type: ignore[arg-type]
        amount=inv.amount,
        tax_amount=inv.tax_amount,
        total_amount=inv.total_amount,
        period_from=inv.period_from,
        period_to=inv.period_to,
        issued_at=inv.issued_at,
        due_date=inv.due_date,
        paid_at=inv.paid_at,
        status=inv.status,      # type: ignore[arg-type]
        note=inv.note,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
        plan=plan,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[LicenseInvoiceOut])
def list_invoices(db: Session = Depends(get_db)) -> List[LicenseInvoiceOut]:
    rows = db.execute(
        select(LicenseInvoiceORM, StoreORM, LicenseORM)
        .join(StoreORM, StoreORM.id == LicenseInvoiceORM.store_id)
        .join(LicenseORM, LicenseORM.id == LicenseInvoiceORM.license_id)
        .order_by(LicenseInvoiceORM.created_at.desc())
    ).all()
    return [_to_out(inv, store.name, lic.plan) for inv, store, lic in rows]


@router.post("", response_model=LicenseInvoiceOut, status_code=status.HTTP_201_CREATED)
def create_invoice(body: LicenseInvoiceCreate, db: Session = Depends(get_db)) -> LicenseInvoiceOut:
    lic = db.get(LicenseORM, body.license_id)
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    store = db.get(StoreORM, lic.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    tax = int(body.amount * TAX_RATE)
    now = datetime.now(timezone.utc)

    inv = LicenseInvoiceORM(
        id=uuid.uuid4(),
        store_id=lic.store_id,
        license_id=body.license_id,
        invoice_number=_next_invoice_number(db),
        type=body.type,
        billing_cycle=body.billing_cycle,
        amount=body.amount,
        tax_amount=tax,
        total_amount=body.amount + tax,
        period_from=body.period_from,
        period_to=body.period_to,
        issued_at=now,
        due_date=body.due_date,
        status="issued",
        note=body.note,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _to_out(inv, store.name, lic.plan)


@router.get("/{invoice_id}", response_model=LicenseInvoiceOut)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)) -> LicenseInvoiceOut:
    row = db.execute(
        select(LicenseInvoiceORM, StoreORM, LicenseORM)
        .join(StoreORM, StoreORM.id == LicenseInvoiceORM.store_id)
        .join(LicenseORM, LicenseORM.id == LicenseInvoiceORM.license_id)
        .where(LicenseInvoiceORM.id == uuid.UUID(invoice_id))
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv, store, lic = row
    return _to_out(inv, store.name, lic.plan)


@router.put("/{invoice_id}/paid", response_model=LicenseInvoiceOut)
def mark_paid(invoice_id: str, db: Session = Depends(get_db)) -> LicenseInvoiceOut:
    inv = db.get(LicenseInvoiceORM, uuid.UUID(invoice_id))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "cancelled":
        raise HTTPException(status_code=400, detail="キャンセル済みの請求書は支払済みにできません")

    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    inv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)

    store = db.get(StoreORM, inv.store_id)
    lic = db.get(LicenseORM, inv.license_id)
    return _to_out(inv, store.name if store else "", lic.plan if lic else "")


@router.put("/{invoice_id}/cancel", response_model=LicenseInvoiceOut)
def cancel_invoice(invoice_id: str, db: Session = Depends(get_db)) -> LicenseInvoiceOut:
    inv = db.get(LicenseInvoiceORM, uuid.UUID(invoice_id))
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="支払済みの請求書はキャンセルできません")

    inv.status = "cancelled"
    inv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)

    store = db.get(StoreORM, inv.store_id)
    lic = db.get(LicenseORM, inv.license_id)
    return _to_out(inv, store.name if store else "", lic.plan if lic else "")


# ─── 店舗向け（自店舗の請求書一覧） ─────────────────────────────────────────
# superadmin 以外でも自店舗の請求書を閲覧できるエンドポイントは
# /store-invoices として別途定義する

from fastapi import APIRouter as _AR
from app.dependencies.request_user import get_current_user

store_router = _AR(
    prefix="/store-invoices",
    tags=["store-invoices"],
    dependencies=[Depends(attach_current_user)],
)


@store_router.get("", response_model=List[LicenseInvoiceOut])
def list_my_invoices(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[LicenseInvoiceOut]:
    """自店舗宛の請求書一覧（admin/manager/staff が閲覧可能）。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    rows = db.execute(
        select(LicenseInvoiceORM, StoreORM, LicenseORM)
        .join(StoreORM, StoreORM.id == LicenseInvoiceORM.store_id)
        .join(LicenseORM, LicenseORM.id == LicenseInvoiceORM.license_id)
        .where(LicenseInvoiceORM.store_id == current_user.store_id)
        .order_by(LicenseInvoiceORM.created_at.desc())
    ).all()
    return [_to_out(inv, store.name, lic.plan) for inv, store, lic in rows]
