from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.master_category import ExpenseCategoryORM, WorkCategoryORM
from app.models.user import User

router = APIRouter(tags=["masters"])


def _resolve_store_id(user: User, store_id: Optional[UUID]) -> UUID:
    if getattr(user, "store_id", None):
        return user.store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


class CategoryOut(BaseModel):
    id: UUID
    store_id: UUID
    name: str
    is_system: bool
    usage_count: int

    class Config:
        from_attributes = True


class CategoryCreateIn(BaseModel):
    store_id: Optional[UUID] = None
    name: str


def _normalize_name(name: str) -> str:
    # 余計な空白を統一
    return " ".join(name.strip().split())


# ----------------------------
# Expense categories
# ----------------------------
@router.get("/master/expense-categories", response_model=List[CategoryOut])
def list_expense_categories(
    store_id: Optional[UUID] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[CategoryOut]:
    sid = _resolve_store_id(user, store_id)
    stmt = select(ExpenseCategoryORM).where(ExpenseCategoryORM.store_id == sid)
    if q:
        stmt = stmt.where(ExpenseCategoryORM.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(ExpenseCategoryORM.is_system.desc(), ExpenseCategoryORM.usage_count.desc(), ExpenseCategoryORM.name.asc()).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("/master/expense-categories", response_model=CategoryOut)
def create_expense_category(
    body: CategoryCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CategoryOut:
    sid = _resolve_store_id(user, body.store_id)
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    row = ExpenseCategoryORM(store_id=sid, name=name, is_system=False, usage_count=0)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # 既存を返す（同名登録を許容しないが、UX的にOK）
        existing = db.execute(
            select(ExpenseCategoryORM).where(
                ExpenseCategoryORM.store_id == sid, ExpenseCategoryORM.name == name
            )
        ).scalar_one_or_none()
        if existing:
            return existing
        raise
    db.refresh(row)
    return row


# ----------------------------
# Work categories
# ----------------------------
@router.get("/master/work-categories", response_model=List[CategoryOut])
def list_work_categories(
    store_id: Optional[UUID] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[CategoryOut]:
    sid = _resolve_store_id(user, store_id)
    stmt = select(WorkCategoryORM).where(WorkCategoryORM.store_id == sid)
    if q:
        stmt = stmt.where(WorkCategoryORM.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(WorkCategoryORM.is_system.desc(), WorkCategoryORM.usage_count.desc(), WorkCategoryORM.name.asc()).limit(limit)
    return db.execute(stmt).scalars().all()


@router.post("/master/work-categories", response_model=CategoryOut)
def create_work_category(
    body: CategoryCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CategoryOut:
    sid = _resolve_store_id(user, body.store_id)
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    row = WorkCategoryORM(store_id=sid, name=name, is_system=False, usage_count=0)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(WorkCategoryORM).where(WorkCategoryORM.store_id == sid, WorkCategoryORM.name == name)
        ).scalar_one_or_none()
        if existing:
            return existing
        raise
    db.refresh(row)
    return row
