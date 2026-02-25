from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
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
# Create schemas (POST /billing)
# ============================================================

class BillingLineIn(BaseModel):
    name: str
    qty: float = 0
    unit: Optional[str] = None
    unit_price: Optional[int] = None
    cost_price: Optional[int] = None


class BillingCreateIn(BaseModel):
    kind: BillingKind = "invoice"
    status: BillingStatus = "draft"
    customer_name: Optional[str] = None
    store_id: Optional[str] = None
    source_work_order_id: Optional[str] = None
    issued_at: Optional[datetime] = None
    lines: list[BillingLineIn] = Field(default_factory=list)
    meta: Optional[dict[str, Any]] = None


def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _to_uuid_str(maybe: Optional[str]) -> Optional[str]:
    if not maybe:
        return None
    try:
        return str(UUID(maybe))
    except Exception:
        return None


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
    where: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        where.append("status = :status")
        params["status"] = status

    if kind:
        where.append("kind = :kind")
        params["kind"] = kind

    where_sql = "WHERE " + " AND ".join(where) if where else ""

    sql = text(
        f"""
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
        """
    )

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
    doc_sql = text(
        """
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
        """
    )

    doc = db.execute(doc_sql, {"id": billing_id}).mappings().first()
    if not doc:
        raise HTTPException(status_code=404, detail="billing not found")

    lines_sql = text(
        """
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
        """
    )

    lines = db.execute(lines_sql, {"id": billing_id}).mappings().all()

    payload = dict(doc)
    payload["lines"] = [dict(x) for x in lines]
    return BillingDocDetailOut.model_validate(payload)


# ============================================================
# POST /billing  (DBへ新規作成)
# ============================================================

@router.post("", response_model=BillingDocDetailOut)
def create_billing(
    body: BillingCreateIn,
    db: Session = Depends(get_db),
):
    billing_id = str(uuid4())

    kind: str = (body.kind or "invoice").strip()
    status: str = (body.status or "draft").strip()
    customer_name = body.customer_name

    store_id = _to_uuid_str(body.store_id)
    source_work_order_id = _to_uuid_str(body.source_work_order_id)

    # totals をサーバ側で計算（改ざん耐性）
    subtotal = 0
    tax_total = 0  # MVP: 税は後で
    line_rows: list[dict[str, Any]] = []

    for idx, ln in enumerate(body.lines):
        name = (ln.name or "").strip()
        if not name:
            continue

        qty = float(ln.qty or 0)
        unit_price = int(ln.unit_price) if ln.unit_price is not None else None
        cost_price = int(ln.cost_price) if ln.cost_price is not None else None
        amount = int(round(qty * unit_price)) if unit_price is not None else None

        if amount is not None:
            subtotal += amount

        line_rows.append(
            {
                "id": str(uuid4()),
                "billing_id": billing_id,
                "name": name,
                "qty": qty,
                "unit": ln.unit,
                "unit_price": unit_price,
                "cost_price": cost_price,
                "amount": amount,
                "sort_order": idx,
            }
        )

    total = subtotal + tax_total
    meta = body.meta or {}

    # documents
    db.execute(
        text(
            """
            INSERT INTO billing_documents (
              id, store_id, kind, status, customer_name,
              subtotal, tax_total, total,
              issued_at, source_work_order_id, meta,
              created_at, updated_at
            ) VALUES (
              :id, :store_id, :kind, :status, :customer_name,
              :subtotal, :tax_total, :total,
              :issued_at, :source_work_order_id, :meta,
              now(), now()
            )
            """
        ),
        {
            "id": billing_id,
            "store_id": store_id,
            "kind": kind,
            "status": status,
            "customer_name": customer_name,
            "subtotal": subtotal,
            "tax_total": tax_total,
            "total": total,
            "issued_at": body.issued_at,
            "source_work_order_id": source_work_order_id,
            "meta": meta,
        },
    )

    # lines
    for lr in line_rows:
        db.execute(
            text(
                """
                INSERT INTO billing_lines (
                  id, billing_id, name, qty, unit,
                  unit_price, cost_price, amount,
                  sort_order, created_at
                ) VALUES (
                  :id, :billing_id, :name, :qty, :unit,
                  :unit_price, :cost_price, :amount,
                  :sort_order, now()
                )
                """
            ),
            lr,
        )

    db.commit()

    # return created (detail)
    doc = db.execute(
        text(
            """
            SELECT
              id, store_id, kind, status, customer_name,
              subtotal, tax_total, total,
              issued_at, source_work_order_id, meta,
              created_at, updated_at
            FROM billing_documents
            WHERE id = :id
            """
        ),
        {"id": billing_id},
    ).mappings().first()

    lines = db.execute(
        text(
            """
            SELECT
              id, billing_id, name, qty, unit,
              unit_price, cost_price, amount,
              sort_order, created_at
            FROM billing_lines
            WHERE billing_id = :id
            ORDER BY sort_order ASC, created_at ASC
            """
        ),
        {"id": billing_id},
    ).mappings().all()

    payload = dict(doc)
    payload["lines"] = [dict(x) for x in lines]
    return BillingDocDetailOut.model_validate(payload)


# ============================================================
# POST /billing/import  (localStorage → DB)
# ============================================================

class BillingImportItem(BaseModel):
    id: Optional[str] = None

    createdAt: Optional[str] = None
    created_at: Optional[str] = None

    customerName: Optional[str] = None
    customer_name: Optional[str] = None

    total: int
    subtotal: Optional[int] = None
    tax_total: Optional[int] = None

    status: Optional[str] = None
    kind: Optional[str] = None

    issued_at: Optional[str] = None

    store_id: Optional[str] = None
    source_work_order_id: Optional[str] = None

    lines: Optional[list[dict[str, Any]]] = None
    meta: Optional[dict[str, Any]] = None


class BillingImportRequest(BaseModel):
    items: list[BillingImportItem]


@router.post("/import")
def import_billing_from_localstorage(
    payload: BillingImportRequest,
    db: Session = Depends(get_db),
    x_import_token: Optional[str] = Header(default=None),
):
    required = os.getenv("BILLING_IMPORT_TOKEN")
    if required and x_import_token != required:
        raise HTTPException(status_code=403, detail="import forbidden")

    inserted = 0
    skipped = 0

    for it in payload.items:
        billing_id = _to_uuid_str(it.id) or str(uuid4())

        created_dt = _parse_dt(it.created_at) or _parse_dt(it.createdAt) or datetime.now(timezone.utc)
        issued_dt = _parse_dt(it.issued_at)

        status = (it.status or "draft").strip()
        kind = (it.kind or "invoice").strip()

        subtotal = it.subtotal if it.subtotal is not None else int(it.total)
        tax_total = it.tax_total if it.tax_total is not None else 0
        total = int(it.total)

        customer_name = it.customer_name or it.customerName

        store_id = _to_uuid_str(it.store_id)
        source_work_order_id = _to_uuid_str(it.source_work_order_id)

        meta = dict(it.meta or {})
        meta.setdefault("_import_source", "localStorage")
        meta.setdefault("_raw", it.model_dump())

        # idempotent: 先に存在チェックして正確にカウント
        exists = db.execute(
            text("SELECT 1 FROM billing_documents WHERE id = :id"),
            {"id": billing_id},
        ).first()
        if exists:
            skipped += 1
            continue

        db.execute(
            text(
                """
                INSERT INTO billing_documents (
                  id, store_id, kind, status, customer_name,
                  subtotal, tax_total, total,
                  issued_at, source_work_order_id, meta,
                  created_at, updated_at
                ) VALUES (
                  :id, :store_id, :kind, :status, :customer_name,
                  :subtotal, :tax_total, :total,
                  :issued_at, :source_work_order_id, :meta,
                  :created_at, :updated_at
                )
                """
            ),
            {
                "id": billing_id,
                "store_id": store_id,
                "kind": kind,
                "status": status,
                "customer_name": customer_name,
                "subtotal": subtotal,
                "tax_total": tax_total,
                "total": total,
                "issued_at": issued_dt,
                "source_work_order_id": source_work_order_id,
                "meta": meta,
                "created_at": created_dt,
                "updated_at": created_dt,
            },
        )

        if it.lines:
            for idx, ln in enumerate(it.lines):
                line_id = _to_uuid_str(str(ln.get("id"))) or str(uuid4())
                name = str(ln.get("name") or ln.get("title") or "item").strip()
                qty = float(ln.get("qty") or ln.get("quantity") or 0)
                unit = ln.get("unit")
                unit_price = ln.get("unit_price") or ln.get("unitPrice")
                cost_price = ln.get("cost_price") or ln.get("costPrice")
                amount = ln.get("amount")

                db.execute(
                    text(
                        """
                        INSERT INTO billing_lines (
                          id, billing_id, name, qty, unit,
                          unit_price, cost_price, amount,
                          sort_order, created_at
                        ) VALUES (
                          :id, :billing_id, :name, :qty, :unit,
                          :unit_price, :cost_price, :amount,
                          :sort_order, :created_at
                        )
                        ON CONFLICT (id) DO NOTHING
                        """
                    ),
                    {
                        "id": line_id,
                        "billing_id": billing_id,
                        "name": name or "item",
                        "qty": qty,
                        "unit": unit,
                        "unit_price": unit_price,
                        "cost_price": cost_price,
                        "amount": amount,
                        "sort_order": int(ln.get("sort_order") or ln.get("sortOrder") or idx),
                        "created_at": created_dt,
                    },
                )

        inserted += 1

    db.commit()
    return {"ok": True, "inserted": inserted, "skipped": skipped}
