from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import uuid4

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.schemas.billing import (
    BillingCreateIn,
    BillingOut,
    BillingImportIn,
    BillingImportOut,
    BillingLineIn,
)

router = APIRouter(tags=["billing"])


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


@router.get("/billing", response_model=List[BillingOut])
def list_billing(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[BillingOut]:
    stmt = (
        select(BillingDocumentORM)
        .order_by(BillingDocumentORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = db.execute(stmt).scalars().all()
    return [_to_out(x) for x in rows]


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
    total = subtotal + tax_total

    # jsonb安全化（dict -> json）
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
        issued_at=now,  # NOT NULL対策
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


@router.post("/billing/import", response_model=BillingImportOut)
def import_billing(
    body: BillingImportIn,
    db: Session = Depends(get_db),
) -> BillingImportOut:
    """
    localStorage の items 配列を受け取り、DBへ移行する。
    成功したら inserted 件数を返す。
    """
    now = _utcnow()
    inserted = 0

    for it in body.items:
        # lines を BillingLineIn に寄せる（unitPrice / unit_price 両対応）
        lines_in: list[BillingLineIn] = []
        for raw in (it.lines or []):
            if not isinstance(raw, dict):
                continue

            name = str(raw.get("name") or "明細").strip()
            if not name:
                continue

            try:
                qty = float(raw.get("qty") or 0)
            except Exception:
                qty = 0.0

            unit_price_raw = raw.get("unit_price")
            if unit_price_raw is None:
                unit_price_raw = raw.get("unitPrice")

            try:
                unit_price = int(unit_price_raw) if unit_price_raw is not None else 0
            except Exception:
                unit_price = 0

            # unit は任意
            unit = raw.get("unit")
            unit_s = str(unit).strip() if unit is not None else None

            lines_in.append(
                BillingLineIn(
                    name=name,
                    qty=qty,
                    unit=unit_s,
                    unit_price=unit_price,
                )
            )

        # subtotal 算出
        subtotal = 0
        for ln in lines_in:
            subtotal += int(float(ln.qty or 0) * int(ln.unit_price or 0))

        # meta（import印を付ける）
        meta_json = json.loads(json.dumps({"_import": "localStorage"}))

        billing_id = uuid4()

        doc = BillingDocumentORM(
            id=billing_id,
            store_id=None,
            kind=it.kind or "invoice",
            status=it.status or "draft",
            customer_name=it.customerName,
            subtotal=subtotal,
            tax_total=0,
            total=subtotal,
            issued_at=now,
            source_work_order_id=None,
            meta=meta_json,
            created_at=now,
            updated_at=now,
        )
        db.add(doc)

        for i, ln in enumerate(lines_in):
            qty = float(ln.qty or 0)
            unit_price = int(ln.unit_price or 0)
            amount = int(qty * unit_price)

            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=qty,
                    unit=ln.unit,
                    unit_price=unit_price,
                    cost_price=int(getattr(ln, "cost_price", 0) or 0),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

        inserted += 1

    db.commit()
    return BillingImportOut(inserted=inserted)


@router.get("/billing/{billing_id}", response_model=BillingOut)
def get_billing(
    billing_id: str,
    db: Session = Depends(get_db),
) -> BillingOut:
    stmt = select(BillingDocumentORM).where(BillingDocumentORM.id == billing_id)
    doc = db.execute(stmt).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    return _to_out(doc)
