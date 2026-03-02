from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.car import Car

router = APIRouter(tags=["export"])


class ExportVehicleOut(BaseModel):
    id: UUID
    stock_no: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    mileage: Optional[int] = None

    export_price: Optional[int] = None
    export_status: Optional[str] = None
    export_image_url: Optional[str] = None
    export_description: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/export/vehicles", response_model=list[ExportVehicleOut])
def list_export_vehicles(db: Session = Depends(get_db)) -> list[ExportVehicleOut]:
    """公開対象（export_enabled=true）の車両一覧（認証不要）"""

    stmt = (
        select(Car)
        .where(Car.export_enabled.is_(True))
        .order_by(Car.updated_at.desc())
        .limit(500)
    )
    return db.execute(stmt).scalars().all()


@router.get("/export/vehicles/{car_id}", response_model=ExportVehicleOut)
def get_export_vehicle(car_id: UUID, db: Session = Depends(get_db)) -> ExportVehicleOut:
    car = db.get(Car, car_id)
    if not car or not getattr(car, "export_enabled", False):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return car
