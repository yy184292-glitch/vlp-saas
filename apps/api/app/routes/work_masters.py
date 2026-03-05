from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.user import User
from app.models.work_master import WorkMasterORM, WorkMasterRateORM
from app.schemas.work_master import (
    WorkMasterCreate, WorkMasterOut, WorkMasterUpdate,
    WorkMasterForVehicle, VEHICLE_CATEGORIES,
)

router = APIRouter(prefix="/work-masters", tags=["work-masters"])


def _is_readonly(wm: WorkMasterORM, user: User) -> bool:
    return wm.store_id is None


def _load_list(db: Session, user: User) -> list[WorkMasterORM]:
    stmt = (
        select(WorkMasterORM)
        .where(or_(WorkMasterORM.store_id == user.store_id, WorkMasterORM.store_id.is_(None)))
        .options(selectinload(WorkMasterORM.rates))
        .order_by(WorkMasterORM.sort_order, WorkMasterORM.work_name)
    )
    return list(db.execute(stmt).scalars().all())


# NOTE: /by-vehicle-category/{category} MUST be defined before /{id}
@router.get("/by-vehicle-category/{vehicle_category}", response_model=list[WorkMasterForVehicle])
def list_by_vehicle_category(
    vehicle_category: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WorkMasterForVehicle]:
    """指定車種の作業時間・工賃付きでフラットに返す"""
    wms = _load_list(db, user)
    result = []
    for wm in wms:
        if not wm.is_active:
            continue
        rate = next((r for r in wm.rates if r.vehicle_category == vehicle_category), None)
        if rate is None:
            continue
        result.append(WorkMasterForVehicle(
            id=wm.id, work_name=wm.work_name, work_category=wm.work_category,
            store_id=wm.store_id, is_active=wm.is_active, sort_order=wm.sort_order,
            duration_minutes=rate.duration_minutes, price=rate.price,
        ))
    return result


@router.get("", response_model=list[WorkMasterOut])
def list_work_masters(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[WorkMasterOut]:
    return [WorkMasterOut.model_validate(wm) for wm in _load_list(db, user)]

@router.get("/{work_master_id}", response_model=WorkMasterOut)
def get_work_master(
    work_master_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkMasterOut:
    wm = db.execute(
        select(WorkMasterORM).where(WorkMasterORM.id == work_master_id).options(selectinload(WorkMasterORM.rates))
    ).scalar_one_or_none()
    if not wm:
        raise HTTPException(status_code=404, detail="Work master not found")
    if wm.store_id is not None and wm.store_id != user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return WorkMasterOut.model_validate(wm)


@router.post("", response_model=WorkMasterOut, status_code=201)
def create_work_master(
    body: WorkMasterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkMasterOut:
    wm = WorkMasterORM(
        id=uuid.uuid4(), work_name=body.work_name,
        work_category=body.work_category, store_id=user.store_id,
        is_active=True, sort_order=body.sort_order,
    )
    db.add(wm)
    db.flush()
    for r in body.rates:
        db.add(WorkMasterRateORM(
            id=uuid.uuid4(), work_master_id=wm.id,
            vehicle_category=r.vehicle_category,
            duration_minutes=r.duration_minutes, price=r.price,
        ))
    db.commit()
    db.refresh(wm)
    db.execute(select(WorkMasterORM).where(WorkMasterORM.id == wm.id).options(selectinload(WorkMasterORM.rates)))
    wm = db.execute(select(WorkMasterORM).where(WorkMasterORM.id == wm.id).options(selectinload(WorkMasterORM.rates))).scalar_one()
    return WorkMasterOut.model_validate(wm)


@router.put("/{work_master_id}", response_model=WorkMasterOut)
def update_work_master(
    work_master_id: uuid.UUID,
    body: WorkMasterUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WorkMasterOut:
    wm = db.execute(
        select(WorkMasterORM).where(WorkMasterORM.id == work_master_id).options(selectinload(WorkMasterORM.rates))
    ).scalar_one_or_none()
    if not wm:
        raise HTTPException(status_code=404, detail="Work master not found")
    if _is_readonly(wm, user):
        raise HTTPException(status_code=403, detail="Cannot edit system default")
    if wm.store_id != user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if body.work_name is not None: wm.work_name = body.work_name
    if body.work_category is not None: wm.work_category = body.work_category
    if body.is_active is not None: wm.is_active = body.is_active
    if body.sort_order is not None: wm.sort_order = body.sort_order
    if body.rates is not None:
        for old in list(wm.rates): db.delete(old)
        db.flush()
        for r in body.rates:
            db.add(WorkMasterRateORM(
                id=uuid.uuid4(), work_master_id=wm.id,
                vehicle_category=r.vehicle_category,
                duration_minutes=r.duration_minutes, price=r.price,
            ))
    db.commit()
    wm = db.execute(select(WorkMasterORM).where(WorkMasterORM.id == wm.id).options(selectinload(WorkMasterORM.rates))).scalar_one()
    return WorkMasterOut.model_validate(wm)


@router.delete("/{work_master_id}", status_code=204, response_model=None)
def delete_work_master(
    work_master_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    wm = db.get(WorkMasterORM, work_master_id)
    if not wm:
        raise HTTPException(status_code=404, detail="Work master not found")
    if _is_readonly(wm, user):
        raise HTTPException(status_code=403, detail="Cannot delete system default")
    if wm.store_id != user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(wm)
    db.commit()
