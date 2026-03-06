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
from app.models.store_staff import StoreStaffORM
from app.models.car_status import CarStatusMasterORM
import uuid
from app.models.user import User

router = APIRouter(tags=["masters"])


DEFAULT_EXPENSE_CATEGORIES = [
    "仕入れ（部材）",
    "外注費",
    "消耗品",
    "工具・設備",
    "燃料費",
    "通信費",
    "広告宣伝",
    "水道光熱",
    "交通費",
    "その他",
]

DEFAULT_WORK_CATEGORIES = [
    "オイル交換",
    "タイヤ交換",
    "車検整備",
    "点検",
    "バッテリー交換",
    "ブレーキ整備",
    "エアコン",
    "洗車",
    "板金・塗装",
    "その他",
]


def _seed_if_empty(db: Session, sid: UUID) -> None:
    # 最初の店舗でマスタが空だとUIが使いづらいので、最小限のプリセットを投入。
    has_expense = db.execute(
        select(ExpenseCategoryORM.id).where(ExpenseCategoryORM.store_id == sid).limit(1)
    ).first()
    has_work = db.execute(
        select(WorkCategoryORM.id).where(WorkCategoryORM.store_id == sid).limit(1)
    ).first()

    changed = False
    if not has_expense:
        for name in DEFAULT_EXPENSE_CATEGORIES:
            db.add(ExpenseCategoryORM(store_id=sid, name=name, is_system=True, usage_count=0))
        changed = True
    if not has_work:
        for name in DEFAULT_WORK_CATEGORIES:
            db.add(WorkCategoryORM(store_id=sid, name=name, is_system=True, usage_count=0))
        changed = True
    if changed:
        db.commit()


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
    _seed_if_empty(db, sid)
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


@router.delete("/master/expense-categories/{category_id}")
def delete_expense_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(ExpenseCategoryORM, category_id)
    if not row or row.store_id != _resolve_store_id(user, None):
        raise HTTPException(status_code=404, detail="not found")
    if row.is_system:
        raise HTTPException(status_code=400, detail="システムカテゴリは削除できません")
    db.delete(row)
    db.commit()
    return {"ok": True}


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
    _seed_if_empty(db, sid)
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


class StoreStaffBase(BaseModel):
    name: str
    name_kana: Optional[str] = None
    postal_code: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    tel: Optional[str] = None


class StoreStaffOut(StoreStaffBase):
    id: UUID
    store_id: UUID

    class Config:
        from_attributes = True


class StoreStaffCreate(StoreStaffBase):
    pass


class StoreStaffUpdate(BaseModel):
    name: Optional[str] = None
    name_kana: Optional[str] = None
    postal_code: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    tel: Optional[str] = None


class CarStatusBase(BaseModel):
    name: str
    color: str = "#E5E7EB"
    sort_order: int = 0


class CarStatusOut(CarStatusBase):
    id: UUID
    store_id: UUID

    class Config:
        from_attributes = True


DEFAULT_CAR_STATUSES = [
    ("在庫", "#DCFCE7", 10),
    ("商談中", "#FEF9C3", 20),
    ("整備中", "#DBEAFE", 30),
    ("売約", "#FFEDD5", 40),
    ("納車済", "#E5E7EB", 50),
]


def _seed_car_status_if_empty(db: Session, sid: UUID) -> None:
    has_status = db.execute(select(CarStatusMasterORM.id).where(CarStatusMasterORM.store_id == sid).limit(1)).first()
    if has_status:
        return
    for name, color, order in DEFAULT_CAR_STATUSES:
        db.add(CarStatusMasterORM(id=uuid.uuid4(), store_id=sid, name=name, color=color, sort_order=order))
    db.commit()


@router.get("/masters/staff", response_model=List[StoreStaffOut])
def list_staff(
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[StoreStaffOut]:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    rows = db.execute(select(StoreStaffORM).where(StoreStaffORM.store_id == sid).order_by(StoreStaffORM.created_at.asc())).scalars().all()
    return rows


@router.post("/masters/staff", response_model=StoreStaffOut)
def create_staff(
    body: StoreStaffCreate,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoreStaffOut:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = StoreStaffORM(id=uuid.uuid4(), store_id=sid, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/masters/staff/{staff_id}", response_model=StoreStaffOut)
def update_staff(
    staff_id: UUID,
    body: StoreStaffUpdate,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StoreStaffOut:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = db.get(StoreStaffORM, staff_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/masters/staff/{staff_id}")
def delete_staff(
    staff_id: UUID,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = db.get(StoreStaffORM, staff_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/masters/car-statuses", response_model=List[CarStatusOut])
def list_car_statuses(
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[CarStatusOut]:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    _seed_car_status_if_empty(db, sid)
    rows = db.execute(select(CarStatusMasterORM).where(CarStatusMasterORM.store_id == sid).order_by(CarStatusMasterORM.sort_order.asc())).scalars().all()
    return rows


@router.post("/masters/car-statuses", response_model=CarStatusOut)
def create_car_status(
    body: CarStatusBase,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CarStatusOut:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = CarStatusMasterORM(id=uuid.uuid4(), store_id=sid, **body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/masters/car-statuses/{status_id}", response_model=CarStatusOut)
def update_car_status(
    status_id: UUID,
    body: CarStatusBase,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CarStatusOut:
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = db.get(CarStatusMasterORM, status_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/masters/car-statuses/{status_id}")
def delete_car_status(
    status_id: UUID,
    store_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sid = user.store_id or store_id
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    row = db.get(CarStatusMasterORM, status_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
