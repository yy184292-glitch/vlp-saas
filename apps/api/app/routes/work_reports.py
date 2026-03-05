from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.user import User
from app.models.work_report import InvoiceORM, WorkReportItemORM, WorkReportORM
from app.schemas.work_report import (
    InvoiceCreate,
    InvoiceOut,
    InvoiceUpdate,
    WorkReportComplete,
    WorkReportCreate,
    WorkReportItemCreate,
    WorkReportItemOut,
    WorkReportItemUpdate,
    WorkReportOut,
    WorkReportUpdate,
)

router = APIRouter(prefix="/work-reports", tags=["work-reports"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _load_report(db: Session, report_id: uuid.UUID, store_id: uuid.UUID) -> WorkReportORM:
    stmt = (
        select(WorkReportORM)
        .where(WorkReportORM.id == report_id, WorkReportORM.store_id == store_id)
        .options(selectinload(WorkReportORM.items))
    )
    report = db.execute(stmt).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Work report not found")
    return report


# ────────────────────────────────────────────
# Work Reports CRUD
# ────────────────────────────────────────────

@router.get("", response_model=List[WorkReportOut])
def list_reports(
    car_id: Optional[uuid.UUID] = None,
    instruction_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[WorkReportOut]:
    stmt = (
        select(WorkReportORM)
        .where(WorkReportORM.store_id == user.store_id)
        .options(selectinload(WorkReportORM.items))
        .order_by(WorkReportORM.created_at.desc())
    )
    if car_id:
        stmt = stmt.where(WorkReportORM.car_id == car_id)
    if instruction_id:
        stmt = stmt.where(WorkReportORM.instruction_id == instruction_id)
    if status:
        stmt = stmt.where(WorkReportORM.status == status)
    rows = db.execute(stmt).scalars().all()
    return [WorkReportOut.model_validate(r) for r in rows]


@router.post("", response_model=WorkReportOut, status_code=201)
def create_report(
    body: WorkReportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportOut:
    report = WorkReportORM(
        id=uuid.uuid4(),
        store_id=user.store_id,
        instruction_id=body.instruction_id,
        car_id=body.car_id,
        title=body.title,
        vehicle_category=body.vehicle_category,
        notes=body.notes,
        status="in_progress",
    )
    db.add(report)
    db.flush()

    for idx, item_in in enumerate(body.items):
        item = WorkReportItemORM(
            id=uuid.uuid4(),
            report_id=report.id,
            work_master_id=item_in.work_master_id,
            item_name=item_in.item_name,
            item_type=item_in.item_type,
            quantity=item_in.quantity,
            unit_price=item_in.unit_price,
            duration_minutes=item_in.duration_minutes,
            memo=item_in.memo,
            sort_order=item_in.sort_order if item_in.sort_order else idx,
        )
        db.add(item)

    db.commit()
    db.refresh(report)
    return WorkReportOut.model_validate(report)


@router.get("/{report_id}", response_model=WorkReportOut)
def get_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportOut:
    report = _load_report(db, report_id, user.store_id)
    return WorkReportOut.model_validate(report)


@router.patch("/{report_id}", response_model=WorkReportOut)
def update_report(
    report_id: uuid.UUID,
    body: WorkReportUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportOut:
    report = _load_report(db, report_id, user.store_id)

    if body.title is not None:
        report.title = body.title
    if body.vehicle_category is not None:
        report.vehicle_category = body.vehicle_category
    if body.status is not None:
        report.status = body.status
    if body.reported_by is not None:
        report.reported_by = body.reported_by
    if body.notes is not None:
        report.notes = body.notes

    db.commit()
    db.refresh(report)
    return WorkReportOut.model_validate(report)


@router.post("/{report_id}/complete", response_model=WorkReportOut)
def complete_report(
    report_id: uuid.UUID,
    body: WorkReportComplete,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportOut:
    report = _load_report(db, report_id, user.store_id)
    report.status = "completed"
    report.completed_at = _utcnow()
    if body.reported_by is not None:
        report.reported_by = body.reported_by
    if body.notes is not None:
        report.notes = body.notes
    db.commit()
    db.refresh(report)
    return WorkReportOut.model_validate(report)


@router.delete("/{report_id}", status_code=204, response_model=None)
def delete_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    report = _load_report(db, report_id, user.store_id)
    db.delete(report)
    db.commit()


# ────────────────────────────────────────────
# Work Report Items
# ────────────────────────────────────────────

@router.post("/{report_id}/items", response_model=WorkReportItemOut, status_code=201)
def add_item(
    report_id: uuid.UUID,
    body: WorkReportItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportItemOut:
    report = _load_report(db, report_id, user.store_id)
    item = WorkReportItemORM(
        id=uuid.uuid4(),
        report_id=report.id,
        work_master_id=body.work_master_id,
        item_name=body.item_name,
        item_type=body.item_type,
        quantity=body.quantity,
        unit_price=body.unit_price,
        duration_minutes=body.duration_minutes,
        memo=body.memo,
        sort_order=body.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return WorkReportItemOut.model_validate(item)


@router.patch("/{report_id}/items/{item_id}", response_model=WorkReportItemOut)
def update_item(
    report_id: uuid.UUID,
    item_id: uuid.UUID,
    body: WorkReportItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkReportItemOut:
    _load_report(db, report_id, user.store_id)
    item = db.get(WorkReportItemORM, item_id)
    if not item or item.report_id != report_id:
        raise HTTPException(status_code=404, detail="Item not found")

    if body.item_name is not None:
        item.item_name = body.item_name
    if body.item_type is not None:
        item.item_type = body.item_type
    if body.quantity is not None:
        item.quantity = body.quantity
    if body.unit_price is not None:
        item.unit_price = body.unit_price
    if body.duration_minutes is not None:
        item.duration_minutes = body.duration_minutes
    if body.is_checked is not None:
        item.is_checked = body.is_checked
        item.checked_at = _utcnow() if body.is_checked else None
    if body.memo is not None:
        item.memo = body.memo
    if body.sort_order is not None:
        item.sort_order = body.sort_order

    db.commit()
    db.refresh(item)
    return WorkReportItemOut.model_validate(item)


@router.delete("/{report_id}/items/{item_id}", status_code=204, response_model=None)
def delete_item(
    report_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _load_report(db, report_id, user.store_id)
    item = db.get(WorkReportItemORM, item_id)
    if not item or item.report_id != report_id:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


# ────────────────────────────────────────────
# Invoices
# ────────────────────────────────────────────

@router.get("/{report_id}/invoices", response_model=List[InvoiceOut])
def list_invoices(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[InvoiceOut]:
    _load_report(db, report_id, user.store_id)
    stmt = select(InvoiceORM).where(InvoiceORM.report_id == report_id)
    rows = db.execute(stmt).scalars().all()
    return [InvoiceOut.model_validate(r) for r in rows]


@router.post("/{report_id}/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(
    report_id: uuid.UUID,
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InvoiceOut:
    _load_report(db, report_id, user.store_id)
    invoice = InvoiceORM(
        id=uuid.uuid4(),
        report_id=report_id,
        invoice_type=body.invoice_type,
        issue_date=body.issue_date,
        due_date=body.due_date,
        subtotal=body.subtotal,
        tax=body.tax,
        total=body.total,
        notes=body.notes,
        status="draft",
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return InvoiceOut.model_validate(invoice)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(
    invoice_id: uuid.UUID,
    body: InvoiceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InvoiceOut:
    invoice = db.get(InvoiceORM, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    # verify store ownership via report
    _load_report(db, invoice.report_id, user.store_id)

    if body.invoice_type is not None:
        invoice.invoice_type = body.invoice_type
    if body.issue_date is not None:
        invoice.issue_date = body.issue_date
    if body.due_date is not None:
        invoice.due_date = body.due_date
    if body.subtotal is not None:
        invoice.subtotal = body.subtotal
    if body.tax is not None:
        invoice.tax = body.tax
    if body.total is not None:
        invoice.total = body.total
    if body.notes is not None:
        invoice.notes = body.notes
    if body.status is not None:
        invoice.status = body.status

    db.commit()
    db.refresh(invoice)
    return InvoiceOut.model_validate(invoice)
