from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID, uuid4

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.schemas.billing import (
    BillingCreateIn,
    BillingUpdateIn,
    BillingOut,
    BillingImportIn,
    BillingImportOut,
    BillingLineIn,
    BillingLineOut,
)

router = APIRouter(tags=["billing"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_out(doc: BillingDocumentORM) -> BillingOut:
    return BillingOut(
        id=doc.id,
        store_id=doc.store_id,
        kind=doc.kind,
        status=doc.status,
        customer_name=doc.customer_name,
        subtotal=doc.subtotal,
        tax_total=doc.tax_total,
        total=doc.total,
        issued_at=doc.issued_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ============================================================
# LIST
# ============================================================

@router.get("/billing", response_model=List[BillingOut])
def list_billing(
    limit: int = 100,
    offset: int = 0,
    status: str | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
) -> List[BillingOut]:

    stmt = select(BillingDocumentORM)

    if status:
        stmt = stmt.where(BillingDocumentORM.status == status)

    if kind:
        stmt = stmt.where(BillingDocumentORM.kind == kind)

    stmt = (
        stmt.order_by(BillingDocumentORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(stmt).scalars().all()

    return [_to_out(x) for x in rows]


# ============================================================
# GET
# ============================================================

@router.get("/billing/{billing_id}", response_model=BillingOut)
def get_billing(
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:

    stmt = select(BillingDocumentORM).where(
        BillingDocumentORM.id == billing_id
    )

    doc = db.execute(stmt).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    return _to_out(doc)


# ============================================================
# GET LINES
# ============================================================

@router.get(
    "/billing/{billing_id}/lines",
    response_model=List[BillingLineOut],
)
def list_billing_lines(
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> List[BillingLineOut]:

    stmt = (
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    )

    return db.execute(stmt).scalars().all()


# ============================================================
# CREATE
# ============================================================

@router.post("/billing", response_model=BillingOut)
def create_billing(
    body: BillingCreateIn,
    db: Session = Depends(get_db),
) -> BillingOut:

    now = _utcnow()
    billing_id = uuid4()

    subtotal = 0

    for ln in body.lines:
        qty = float(ln.qty or 0)
        unit_price = int(ln.unit_price or 0)
        subtotal += int(qty * unit_price)

    tax_total = 0
    total = subtotal

    issued_at = body.issued_at

    if (body.status or "draft") == "issued" and issued_at is None:
        issued_at = now

    meta_json = json.loads(json.dumps(body.meta or {}))

    doc = BillingDocumentORM(
        id=billing_id,
        store_id=body.store_id,
        kind=body.kind or "invoice",
        status=body.status or "draft",
        customer_name=body.customer_name,
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
        issued_at=issued_at,
        source_work_order_id=body.source_work_order_id,
        meta=meta_json,
        created_at=now,
        updated_at=now,
    )

    db.add(doc)

    for i, ln in enumerate(body.lines):

        qty = float(ln.qty or 0)
        unit_price = int(ln.unit_price or 0)
        cost_price = int(ln.cost_price or 0)

        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=billing_id,
                name=ln.name,
                qty=qty,
                unit=ln.unit,
                unit_price=unit_price,
                cost_price=cost_price,
                amount=int(qty * unit_price),
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
    billing_id: UUID,
    body: BillingUpdateIn,
    db: Session = Depends(get_db),
) -> BillingOut:

    now = _utcnow()

    stmt = select(BillingDocumentORM).where(
        BillingDocumentORM.id == billing_id
    )

    doc = db.execute(stmt).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    if body.kind is not None:
        doc.kind = body.kind

    if body.status is not None:
        doc.status = body.status

    if body.customer_name is not None:
        doc.customer_name = body.customer_name

    if body.meta is not None:
        doc.meta = json.loads(json.dumps(body.meta))

    if body.lines is not None:

        db.execute(
            delete(BillingLineORM).where(
                BillingLineORM.billing_id == billing_id
            )
        )

        subtotal = 0

        for i, ln in enumerate(body.lines):

            qty = float(ln.qty or 0)
            unit_price = int(ln.unit_price or 0)

            subtotal += int(qty * unit_price)

            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=qty,
                    unit=ln.unit,
                    unit_price=unit_price,
                    cost_price=int(ln.cost_price or 0),
                    amount=int(qty * unit_price),
                    sort_order=i,
                    created_at=now,
                )
            )

        doc.subtotal = subtotal
        doc.tax_total = 0
        doc.total = subtotal

    doc.updated_at = now

    db.commit()
    db.refresh(doc)

    return _to_out(doc)


# ============================================================
# DELETE
# ============================================================

@router.delete("/billing/{billing_id}")
def delete_billing(
    billing_id: UUID,
    db: Session = Depends(get_db),
):

    stmt = select(BillingDocumentORM).where(
        BillingDocumentORM.id == billing_id
    )

    doc = db.execute(stmt).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    db.execute(
        delete(BillingLineORM).where(
            BillingLineORM.billing_id == billing_id
        )
    )

    db.delete(doc)

    db.commit()

    return {"deleted": True}


# ============================================================
# IMPORT
# ============================================================

@router.post("/billing/import", response_model=BillingImportOut)
def import_billing(
    body: BillingImportIn,
    db: Session = Depends(get_db),
) -> BillingImportOut:

    now = _utcnow()
    inserted = 0

    for it in body.items:

        billing_id = uuid4()

        subtotal = 0

        for ln in it.lines or []:
            subtotal += int(
                float(ln.get("qty", 0))
                * int(ln.get("unit_price", 0))
            )

        doc = BillingDocumentORM(
            id=billing_id,
            kind=it.kind,
            status=it.status,
            customer_name=it.customerName,
            subtotal=subtotal,
            tax_total=0,
            total=subtotal,
            issued_at=now,
            meta={"_import": "localStorage"},
            created_at=now,
            updated_at=now,
        )

        db.add(doc)

        inserted += 1

    db.commit()

    return BillingImportOut(inserted=inserted)
