from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.maintenance_preset import MaintenancePresetORM
from app.models.user import User
from app.schemas.maintenance_preset import (
    MaintenancePresetCreate,
    MaintenancePresetOut,
    MaintenancePresetUpdate,
    VEHICLE_CATEGORIES,
)

router = APIRouter(prefix="/maintenance-presets", tags=["maintenance-presets"])


@router.get("", response_model=list[MaintenancePresetOut])
def list_presets(
    vehicle_category: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MaintenancePresetOut]:
    """店舗固有プリセット + システムデフォルト（store_id=NULL）を返す"""
    stmt = (
        select(MaintenancePresetORM)
        .where(
            or_(
                MaintenancePresetORM.store_id == user.store_id,
                MaintenancePresetORM.store_id.is_(None),
            )
        )
        .order_by(MaintenancePresetORM.sort_order, MaintenancePresetORM.name)
    )
    if vehicle_category:
        stmt = stmt.where(MaintenancePresetORM.vehicle_category == vehicle_category)

    rows = db.execute(stmt).scalars().all()
    return [MaintenancePresetOut.model_validate(r) for r in rows]


@router.get("/categories", response_model=list[str])
def list_categories() -> list[str]:
    """車両カテゴリ一覧"""
    return VEHICLE_CATEGORIES


@router.post("", response_model=MaintenancePresetOut, status_code=201)
def create_preset(
    body: MaintenancePresetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MaintenancePresetOut:
    """店舗固有プリセットを作成"""
    preset = MaintenancePresetORM(
        id=uuid.uuid4(),
        store_id=user.store_id,
        name=body.name,
        vehicle_category=body.vehicle_category,
        duration_minutes=body.duration_minutes,
        labor_price=body.labor_price,
        is_default=False,
        sort_order=body.sort_order,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return MaintenancePresetOut.model_validate(preset)


@router.put("/{preset_id}", response_model=MaintenancePresetOut)
def update_preset(
    preset_id: uuid.UUID,
    body: MaintenancePresetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MaintenancePresetOut:
    """プリセットを更新（自店舗のプリセットのみ）"""
    preset = db.get(MaintenancePresetORM, preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    if preset.store_id != user.store_id:
        raise HTTPException(status_code=403, detail="Cannot edit another store's preset")

    if body.name is not None:
        preset.name = body.name
    if body.vehicle_category is not None:
        preset.vehicle_category = body.vehicle_category
    if body.duration_minutes is not None:
        preset.duration_minutes = body.duration_minutes
    if body.labor_price is not None:
        preset.labor_price = body.labor_price
    if body.sort_order is not None:
        preset.sort_order = body.sort_order

    db.commit()
    db.refresh(preset)
    return MaintenancePresetOut.model_validate(preset)


@router.delete("/{preset_id}", status_code=204, response_model=None)
def delete_preset(
    preset_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """プリセットを削除（自店舗のプリセットのみ）"""
    preset = db.get(MaintenancePresetORM, preset_id)
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    if preset.store_id != user.store_id:
        raise HTTPException(status_code=403, detail="Cannot delete another store's preset")

    db.delete(preset)
    db.commit()
