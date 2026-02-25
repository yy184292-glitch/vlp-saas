from __future__ import annotations

from uuid import uuid4
from datetime import datetime, timezone
from typing import List, Optional

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.schemas.billing import BillingCreateIn, BillingOut


router = APIRouter(prefix="/api/v1", tags=["billing"])


# =========================
# util
# =========================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_out(doc: BillingDocumentORM) -> BillingOut:
    return BillingOut(
        id=str(doc.id),
        store_id=str(doc.store_id) if doc.store_id else None,
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


# =========================
# GET list
# =========================

@router.get("/billing", response_model=List[BillingOut])
def list_billing(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):

    stmt = (
        select(BillingDocumentORM)
        .order_by(BillingDocumentORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = db.execute(stmt).scalars().all()

    return [_to_out(x) for x in rows]


# =========================
# POST create
# =========================

@router.post("/billing", response_model=BillingOut)
def create_billing(
    body: BillingCreateIn,
    db: Session = Depends(get_db),
):

    billing_id = uuid4()
    now = _utcnow()

    # subtotal計算
    subtotal = 0

    for ln in body.lines:

        qty = float(ln.qty)
        unit_price = int(ln.unit_price or 0)

        subtotal += int(qty * unit_price)

    tax_total = 0
    total = subtotal

    # jsonb安全変換（重要）
    meta_json = json.loads(json.dumps(body.meta or {}))

    # billing_documents
    doc = BillingDocumentORM(
        id=billing_id,
        store_id=body.store_id,
        kind=body.kind or "invoice",
        status=body.status or "draft",
        customer_name=body.customer_name,
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,

        # NOT NULL対策
        issued_at=now,

        meta=meta_json,

        created_at=now,
        updated_at=now,
    )

    db.add(doc)

    # billing_lines
    for i, ln in enumerate(body.lines):

        qty = float(ln.qty)
        unit_price = int(ln.unit_price or 0)
        cost_price = int(ln.cost_price or 0)
        amount = int(qty * unit_price)

        line = BillingLineORM(
            id=uuid4(),
            billing_id=billing_id,
            name=ln.name,
            qty=qty,
            unit=ln.unit,
            unit_price=unit_price,
            cost_price=cost_price,
            amount=amount,
            sort_order=i,
            created_at=now,
        )

        db.add(line)

    db.commit()
    db.refresh(doc)

    return _to_out(doc)


# =========================
# GET single
# =========================

@router.get("/billing/{billing_id}", response_model=BillingOut)
def get_billing(
    billing_id: str,
    db: Session = Depends(get_db),
):

    stmt = select(BillingDocumentORM).where(
        BillingDocumentORM.id == billing_id
    )

    doc = db.execute(stmt).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    return _to_out(doc)
