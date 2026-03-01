from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.work import WorkORM
from app.models.work_material import WorkMaterialORM
from app.models.inventory import InventoryItemORM
from app.schemas.work import WorkCreateIn, WorkOut, WorkUpdateIn
from app.schemas.work_material import (
    WorkMaterialCreateIn,
    WorkMaterialOut,
    WorkMaterialUpdateIn,
)

router = APIRouter(tags=["work"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


def _require_store_id(request: Request, body_store_id: Optional[UUID]) -> UUID:
    actor_store_id = _get_actor_store_id(request)
    store_id = actor_store_id or body_store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


def _assert_store_scope(store_id: UUID, actor_store_id: Optional[UUID]) -> None:
    # token/store scope がある場合だけチェック
    if actor_store_id and store_id != actor_store_id:
        raise HTTPException(status_code=404, detail="Not found")


# ============================================================
# Work CRUD
# ============================================================

@router.get("/works", response_model=List[WorkOut])
def list_works(
    request: Request,
    q: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[WorkOut]:
    actor_store_id = _get_actor_store_id(request)
    if not actor_store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    stmt = select(WorkORM).where(WorkORM.store_id == actor_store_id)

    if q:
        # 軽い部分一致（必要ならILIKEに変更）
        stmt = stmt.where(WorkORM.name.contains(q))

    stmt = stmt.order_by(WorkORM.name.asc()).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


@router.post("/works", response_model=WorkOut)
def create_work(
    request: Request,
    body: WorkCreateIn,
    db: Session = Depends(get_db),
) -> WorkOut:
    store_id = _require_store_id(request, body.store_id)
    _assert_store_scope(store_id, _get_actor_store_id(request))

    now = _utcnow()

    work = WorkORM(
        id=uuid4(),
        store_id=store_id,
        code=(body.code.strip() if body.code else None),
        name=body.name.strip(),
        unit=(body.unit.strip() if body.unit else None),
        unit_price=Decimal(str(body.unit_price or 0)),
        note=body.note,
        created_at=now,
        updated_at=now,
    )
    db.add(work)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(work)
    return work


@router.get("/works/{work_id}", response_model=WorkOut)
def get_work(
    request: Request,
    work_id: UUID,
    db: Session = Depends(get_db),
) -> WorkOut:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(work.store_id, _get_actor_store_id(request))
    return work


@router.put("/works/{work_id}", response_model=WorkOut)
def update_work(
    request: Request,
    work_id: UUID,
    body: WorkUpdateIn,
    db: Session = Depends(get_db),
) -> WorkOut:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    if body.code is not None:
        work.code = body.code.strip() if body.code else None
    if body.name is not None:
        work.name = body.name.strip()
    if body.unit is not None:
        work.unit = body.unit.strip() if body.unit else None
    if body.unit_price is not None:
        work.unit_price = Decimal(str(body.unit_price))
    if body.note is not None:
        work.note = body.note

    work.updated_at = _utcnow()

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(work)
    return work


@router.delete("/works/{work_id}")
def delete_work(
    request: Request,
    work_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    # BOM を先に削除（FK CASCADEでもOKだが明示）
    db.execute(delete(WorkMaterialORM).where(WorkMaterialORM.work_id == work_id))
    db.delete(work)
    db.commit()
    return {"deleted": True}


# ============================================================
# Work BOM (WorkMaterial)
# ============================================================

@router.get("/works/{work_id}/materials", response_model=List[WorkMaterialOut])
def list_work_materials(
    request: Request,
    work_id: UUID,
    db: Session = Depends(get_db),
) -> List[WorkMaterialOut]:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    stmt = (
        select(WorkMaterialORM)
        .where(WorkMaterialORM.work_id == work_id)
        .order_by(WorkMaterialORM.created_at.asc())
    )
    return db.execute(stmt).scalars().all()


@router.post("/works/{work_id}/materials", response_model=WorkMaterialOut)
def add_work_material(
    request: Request,
    work_id: UUID,
    body: WorkMaterialCreateIn,
    db: Session = Depends(get_db),
) -> WorkMaterialOut:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    # body.work_id は互換用：URL優先
    item = db.get(InventoryItemORM, body.item_id)
    if not item or item.store_id != work.store_id:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    now = _utcnow()

    mat = WorkMaterialORM(
        id=uuid4(),
        store_id=work.store_id,
        work_id=work_id,
        item_id=body.item_id,
        qty_per_work=Decimal(str(body.qty_per_work)),
        created_at=now,
        updated_at=now,
    )
    db.add(mat)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        # 既に同じ item が登録済みなど
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(mat)
    return mat


@router.put("/works/{work_id}/materials/{material_id}", response_model=WorkMaterialOut)
def update_work_material(
    request: Request,
    work_id: UUID,
    material_id: UUID,
    body: WorkMaterialUpdateIn,
    db: Session = Depends(get_db),
) -> WorkMaterialOut:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    mat = db.get(WorkMaterialORM, material_id)
    if not mat or mat.work_id != work_id:
        raise HTTPException(status_code=404, detail="Not found")

    if body.qty_per_work is not None:
        mat.qty_per_work = Decimal(str(body.qty_per_work))

    mat.updated_at = _utcnow()

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(mat)
    return mat


@router.delete("/works/{work_id}/materials/{material_id}")
def delete_work_material(
    request: Request,
    work_id: UUID,
    material_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    work = db.get(WorkORM, work_id)
    if not work:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_store_scope(work.store_id, _get_actor_store_id(request))

    mat = db.get(WorkMaterialORM, material_id)
    if not mat or mat.work_id != work_id:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(mat)
    db.commit()
    return {"deleted": True}