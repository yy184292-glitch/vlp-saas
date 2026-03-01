from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.expense import ExpenseORM
from app.models.user import User

router = APIRouter(tags=["expenses"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_date(value: str) -> date:
    try:
        # YYYY-MM-DD
        return date.fromisoformat(value)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from e


def _resolve_store_id(user: User, store_id: Optional[UUID]) -> UUID:
    """store_id の決定

    - 原則: user.store_id があればそれを固定（他店を見れない）
    - 例外: user.store_id が無い運用（管理者）ならクエリ/ボディの store_id を必須
    """
    actor_store_id = getattr(user, "store_id", None)
    if isinstance(actor_store_id, UUID):
        if store_id and store_id != actor_store_id:
            raise HTTPException(status_code=404, detail="Not found")
        return actor_store_id

    # actor に store_id が無い → 指定必須
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


# ============================================================
# schemas
# ============================================================

class ExpenseCreateIn(BaseModel):
    store_id: Optional[UUID] = None

    expense_date: date = Field(..., description="YYYY-MM-DD")
    category: str = Field(..., max_length=64)
    title: str = Field(..., max_length=255)

    vendor: Optional[str] = Field(default=None, max_length=255)
    amount: Decimal = Field(default=Decimal("0"))

    payment_method: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None


class ExpenseUpdateIn(BaseModel):
    expense_date: Optional[date] = None
    category: Optional[str] = Field(default=None, max_length=64)
    title: Optional[str] = Field(default=None, max_length=255)

    vendor: Optional[str] = Field(default=None, max_length=255)
    amount: Optional[Decimal] = None

    payment_method: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None


class ExpenseOut(BaseModel):
    id: UUID
    store_id: UUID

    expense_date: date
    category: str
    title: str

    vendor: Optional[str]
    amount: Decimal

    payment_method: Optional[str]
    note: Optional[str]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseListOut(BaseModel):
    items: List[ExpenseOut]
    total: int


# ============================================================
# endpoints
# ============================================================

@router.get("/expenses", response_model=ExpenseListOut)
def list_expenses(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str = Query("", max_length=200),

    start: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(default=None, description="YYYY-MM-DD"),

    category: Optional[str] = Query(default=None, max_length=64),
    store_id: Optional[UUID] = Query(default=None),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseListOut:
    sid = _resolve_store_id(user, store_id)

    cond = [ExpenseORM.store_id == sid]

    if start:
        cond.append(ExpenseORM.expense_date >= _to_date(start))
    if end:
        cond.append(ExpenseORM.expense_date <= _to_date(end))
    if category:
        cond.append(ExpenseORM.category == category)

    if q.strip():
        qs = f"%{q.strip()}%"
        cond.append(
            or_(
                ExpenseORM.title.ilike(qs),
                ExpenseORM.vendor.ilike(qs),
                ExpenseORM.note.ilike(qs),
            )
        )

    stmt = (
        select(ExpenseORM)
        .where(and_(*cond))
        .order_by(ExpenseORM.expense_date.desc(), ExpenseORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = db.execute(stmt).scalars().all()

    total = db.execute(
        select(func.count()).select_from(ExpenseORM).where(and_(*cond))
    ).scalar_one()

    return ExpenseListOut(items=items, total=int(total or 0))


@router.post("/expenses", response_model=ExpenseOut)
def create_expense(
    body: ExpenseCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    now = _utcnow()
    sid = _resolve_store_id(user, body.store_id)

    exp = ExpenseORM(
        id=uuid4(),
        store_id=sid,
        expense_date=body.expense_date,
        category=body.category.strip(),
        title=body.title.strip(),
        vendor=(body.vendor.strip() if body.vendor else None),
        amount=body.amount,
        payment_method=(body.payment_method.strip() if body.payment_method else None),
        note=body.note,
        created_at=now,
        updated_at=now,
    )

    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: UUID,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")
    return exp


@router.put("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: UUID,
    body: ExpenseUpdateIn,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    if body.expense_date is not None:
        exp.expense_date = body.expense_date
    if body.category is not None:
        exp.category = body.category.strip()
    if body.title is not None:
        exp.title = body.title.strip()
    if body.vendor is not None:
        exp.vendor = body.vendor.strip() if body.vendor else None
    if body.amount is not None:
        exp.amount = body.amount
    if body.payment_method is not None:
        exp.payment_method = body.payment_method.strip() if body.payment_method else None
    if body.note is not None:
        exp.note = body.note

    exp.updated_at = _utcnow()
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: UUID,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(exp)
    db.commit()
    return Response(status_code=204)


@router.get("/expenses/export")
def export_expenses_csv(
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    category: Optional[str] = Query(default=None, max_length=64),
    q: str = Query("", max_length=200),
    store_id: Optional[UUID] = Query(default=None),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """期間指定でCSV出力（Excel想定でUTF-8 BOM付き）"""
    sid = _resolve_store_id(user, store_id)

    d1 = _to_date(start)
    d2 = _to_date(end)
    if d2 < d1:
        raise HTTPException(status_code=400, detail="end must be >= start")

    cond = [
        ExpenseORM.store_id == sid,
        ExpenseORM.expense_date >= d1,
        ExpenseORM.expense_date <= d2,
    ]
    if category:
        cond.append(ExpenseORM.category == category)

    if q.strip():
        qs = f"%{q.strip()}%"
        cond.append(or_(ExpenseORM.title.ilike(qs), ExpenseORM.vendor.ilike(qs), ExpenseORM.note.ilike(qs)))

    rows = db.execute(
        select(ExpenseORM)
        .where(and_(*cond))
        .order_by(ExpenseORM.expense_date.asc(), ExpenseORM.created_at.asc())
    ).scalars().all()

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["日付", "カテゴリ", "件名", "取引先", "金額", "支払方法", "メモ", "登録日時"])
    for r in rows:
        writer.writerow([
            r.expense_date.isoformat(),
            r.category or "",
            r.title or "",
            r.vendor or "",
            str(r.amount) if r.amount is not None else "0",
            r.payment_method or "",
            (r.note or "").replace("\r", " ").replace("\n", " "),
            r.created_at.isoformat(),
        ])

    csv_text = out.getvalue()
    # Excel の文字化け回避（UTF-8 BOM）
    bom = "\ufeff"
    data = (bom + csv_text).encode("utf-8")

    filename = f"expenses_{d1.isoformat()}_{d2.isoformat()}.csv"
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
