from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select, and_
from sqlalchemy.orm import Session

from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP, ROUND_CEILING

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.models.system_setting import SystemSettingORM
from app.models.billing_sequence import BillingSequenceORM

from app.schemas.billing import (
    BillingCreateIn,
    BillingImportIn,
    BillingImportOut,
    BillingLineIn,
    BillingLineOut,
    BillingOut,
    BillingUpdateIn,
)

router = APIRouter(tags=["billing"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _jsonb_safe(v: Any) -> Any:
    return json.loads(json.dumps(v))


# ============================================================
# tax
# ============================================================

def _get_tax_defaults(db: Session) -> tuple[Decimal, str, str]:

    row = db.execute(
        select(SystemSettingORM).where(SystemSettingORM.key == "tax")
    ).scalar_one_or_none()

    if not row or not isinstance(row.value, dict):
        return Decimal("0.10"), "exclusive", "floor"

    return (
        Decimal(str(row.value.get("rate", "0.10"))),
        str(row.value.get("mode", "exclusive")),
        str(row.value.get("rounding", "floor")),
    )


def _round_tax(value: Decimal, rounding: str) -> int:

    if rounding == "floor":
        return int(value.to_integral_value(rounding=ROUND_FLOOR))

    if rounding == "ceil":
        return int(value.to_integral_value(rounding=ROUND_CEILING))

    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def _recalc(
    lines: list[BillingLineIn],
    tax_rate: Decimal,
    tax_mode: str,
    tax_rounding: str,
) -> tuple[int, int, int]:

    subtotal = 0

    for ln in lines:
        qty = Decimal(str(ln.qty or 0))
        unit_price = Decimal(str(ln.unit_price or 0))
        subtotal += int(qty * unit_price)

    subtotal_dec = Decimal(subtotal)

    if tax_mode == "inclusive":

        tax = subtotal_dec * tax_rate / (Decimal("1") + tax_rate)
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal

    else:

        tax = subtotal_dec * tax_rate
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal + tax_total

    return subtotal, tax_total, total


# ============================================================
# doc_no sequence
# ============================================================

def _next_doc_no(
    db: Session,
    store_id: UUID,
    kind: str,
) -> str:

    year = datetime.now().year

    seq = db.execute(
        select(BillingSequenceORM)
        .where(
            and_(
                BillingSequenceORM.store_id == store_id,
                BillingSequenceORM.year == year,
                BillingSequenceORM.kind == kind,
            )
        )
        .with_for_update()
    ).scalar_one_or_none()

    if not seq:

        seq = BillingSequenceORM(
            store_id=store_id,
            year=year,
            kind=kind,
            next_no=1,
        )

        db.add(seq)
        db.flush()

    number = seq.next_no
    seq.next_no += 1

    prefix = "INV" if kind == "invoice" else "EST"

    return f"{prefix}-{year}-{number:05d}"


# ============================================================
# convert estimate → invoice
# ============================================================

def _convert_to_invoice(
    db: Session,
    source: BillingDocumentORM,
    store_id: UUID,
) -> BillingDocumentORM:

    if source.kind != "estimate":
        raise HTTPException(400, "Only estimate can convert")

    new_id = uuid4()

    doc_no = _next_doc_no(db, store_id, "invoice")

    now = _utcnow()

    invoice = BillingDocumentORM(
        id=new_id,
        store_id=store_id,
        kind="invoice",
        status="draft",
        doc_no=doc_no,
        customer_name=source.customer_name,
        subtotal=source.subtotal,
        tax_total=source.tax_total,
        total=source.total,
        tax_rate=source.tax_rate,
        tax_mode=source.tax_mode,
        tax_rounding=source.tax_rounding,
        issued_at=None,
        source_work_order_id=source.source_work_order_id,
        meta=_jsonb_safe(source.meta or {}),
        created_at=now,
        updated_at=now,
    )

    db.add(invoice)

    lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == source.id)
        .order_by(BillingLineORM.sort_order)
    ).scalars().all()

    for ln in lines:

        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=new_id,
                name=ln.name,
                qty=ln.qty,
                unit=ln.unit,
                unit_price=ln.unit_price,
                cost_price=ln.cost_price,
                amount=ln.amount,
                sort_order=ln.sort_order,
                created_at=now,
            )
        )

    return invoice


# ============================================================
# mapper
# ============================================================

def _to_out(doc: BillingDocumentORM) -> BillingOut:

    return BillingOut(
        id=doc.id,
        store_id=doc.store_id,
        kind=doc.kind,
        status=doc.status,
        doc_no=doc.doc_no,
        customer_name=doc.customer_name,
        subtotal=doc.subtotal,
        tax_total=doc.tax_total,
        total=doc.total,
        tax_rate=doc.tax_rate,
        tax_mode=doc.tax_mode,
        tax_rounding=doc.tax_rounding,
        issued_at=doc.issued_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ============================================================
# auth helper
# ============================================================

def _get_actor_store_id(request: Request) -> Optional[UUID]:

    user = getattr(request.state, "user", None)

    store_id = getattr(user, "store_id", None)

    if isinstance(store_id, UUID):
        return store_id

    if isinstance(store_id, str):

        try:
            return UUID(store_id)
        except Exception:
            return None

    return None


def _assert_scope(doc: BillingDocumentORM, store_id: Optional[UUID]):

    if store_id and doc.store_id != store_id:
        raise HTTPException(404, "Not found")


# ============================================================
# CREATE
# ============================================================

@router.post("/billing", response_model=BillingOut)
def create_billing(
    request: Request,
    body: BillingCreateIn,
    db: Session = Depends(get_db),
):

    store_id = _get_actor_store_id(request) or body.store_id

    if not store_id:
        raise HTTPException(400, "store_id required")

    tax_rate, tax_mode, tax_rounding = _get_tax_defaults(db)

    subtotal, tax_total, total = _recalc(
        body.lines,
        tax_rate,
        tax_mode,
        tax_rounding,
    )

    doc_no = _next_doc_no(db, store_id, body.kind or "invoice")

    now = _utcnow()

    doc = BillingDocumentORM(
        id=uuid4(),
        store_id=store_id,
        kind=body.kind or "invoice",
        status=body.status or "draft",
        doc_no=doc_no,
        customer_name=body.customer_name,
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
        tax_rate=tax_rate,
        tax_mode=tax_mode,
        tax_rounding=tax_rounding,
        issued_at=None,
        meta=_jsonb_safe(body.meta or {}),
        created_at=now,
        updated_at=now,
    )

    db.add(doc)

    for i, ln in enumerate(body.lines):

        amount = int(Decimal(str(ln.qty or 0)) * Decimal(str(ln.unit_price or 0)))

        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=doc.id,
                name=ln.name,
                qty=ln.qty,
                unit=ln.unit,
                unit_price=ln.unit_price,
                cost_price=int(ln.cost_price or 0),
                amount=amount,
                sort_order=i,
                created_at=now,
            )
        )

    db.commit()

    db.refresh(doc)

    return _to_out(doc)


# ============================================================
# UPDATE
# ============================================================

@router.put("/billing/{billing_id}", response_model=BillingOut)
def update_billing(
    request: Request,
    billing_id: UUID,
    body: BillingUpdateIn,
    db: Session = Depends(get_db),
):

    doc = db.get(BillingDocumentORM, billing_id)

    if not doc:
        raise HTTPException(404)

    _assert_scope(doc, _get_actor_store_id(request))

    now = _utcnow()

    if body.lines is not None:

        subtotal, tax_total, total = _recalc(
            body.lines,
            doc.tax_rate,
            doc.tax_mode,
            doc.tax_rounding,
        )

        doc.subtotal = subtotal
        doc.tax_total = tax_total
        doc.total = total

        db.execute(
            delete(BillingLineORM)
            .where(BillingLineORM.billing_id == billing_id)
        )

        for i, ln in enumerate(body.lines):

            amount = int(
                Decimal(str(ln.qty or 0))
                * Decimal(str(ln.unit_price or 0))
            )

            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=ln.qty,
                    unit=ln.unit,
                    unit_price=ln.unit_price,
                    cost_price=int(ln.cost_price or 0),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

    doc.updated_at = now

    db.commit()

    db.refresh(doc)

    return _to_out(doc)


# ============================================================
# CONVERT
# ============================================================

@router.post("/billing/{billing_id}/convert", response_model=BillingOut)
def convert_invoice(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
):

    source = db.get(BillingDocumentORM, billing_id)

    if not source:
        raise HTTPException(404)

    store_id = _get_actor_store_id(request)

    invoice = _convert_to_invoice(db, source, store_id)

    db.commit()

    db.refresh(invoice)

    return _to_out(invoice)
