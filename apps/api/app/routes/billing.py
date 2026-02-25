from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db


router = APIRouter(prefix="/billing", tags=["billing"])


BillingStatus = Literal["draft", "issued", "void"]
BillingKind = Literal["estimate", "invoice"]


# ============================================================
# Response schemas
# ============================================================

class BillingLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    billing_id: UUID
    name: str
    qty: float
    unit: Optional[str] = None
    unit_price: Optional[int] = None
    cost_price: Optional[int] = None
    amount: Optional[int] = None
    sort_order: int
    created_at: datetime


class BillingDocOut(BaseModel):
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
    source_work_order_id: Optional[UUID] = None
    meta: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class BillingDocDetailOut(BillingDocOut):
    lines: list[BillingLineOut] = Field(default_factory=list)


# ============================================================
# GET /billing
# ============================================================

@router.get("", response_model=list[BillingDocOut])
def list_billing(
    status: Optional[BillingStatus] = Query(default=None),
    kind: Optional[BillingKind] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    where = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        where.append("status = :status")
        params["status"] = status

    if kind:
        where.append("kind = :kind")
        params["kind"] = kind

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    sql = text(f"""
        SELECT
            id,
            store_id,
            kind,
            status,
            customer_name,
            subtotal,
            tax_total,
            total,
            issued_at,
            source_work_order_id,
            meta,
            created_at,
            updated_at
        FROM billing_documents
        {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    rows = db.execute(sql, params).mappings().all()

    return [BillingDocOut.model_validate(dict(r)) for r in rows]


# ============================================================
# GET /billing/{id}
# ============================================================

@router.get("/{billing_id}", response_model=BillingDocDetailOut)
def get_billing(
    billing_id: UUID,
    db: Session = Depends(get_db),
):
    doc_sql = text("""
        SELECT
            id,
            store_id,
            kind,
            status,
            customer_name,
            subtotal,
            tax_total,
            total,
            issued_at,
            source_work_order_id,
            meta,
            created_at,
            updated_at
        FROM billing_documents
        WHERE id = :id
    """)

    doc = db.execute(doc_sql, {"id": billing_id}).mappings().first()

    if not doc:
        raise HTTPException(status_code=404, detail="billing not found")

    lines_sql = text("""
        SELECT
            id,
            billing_id,
            name,
            qty,
            unit,
            unit_price,
            cost_price,
            amount,
            sort_order,
            created_at
        FROM billing_lines
        WHERE billing_id = :id
        ORDER BY sort_order ASC, created_at ASC
    """)

    lines = db.execute(lines_sql, {"id": billing_id}).mappings().all()

    payload = dict(doc)
    payload["lines"] = [dict(x) for x in lines]

    return BillingDocDetailOut.model_validate(payload)
