from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


VEHICLE_CATEGORIES = [
    "軽自動車",
    "普通小型",
    "普通中大型",
    "トラック小型（2t以下）",
    "トラック中型（2t超8t以下）",
    "トラック大型（8t超）",
]


class MaintenancePresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    vehicle_category: str = Field(..., max_length=50)
    duration_minutes: int = Field(..., ge=1)
    labor_price: Optional[int] = Field(default=None, ge=0)
    sort_order: int = Field(default=0)


class MaintenancePresetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    vehicle_category: Optional[str] = Field(default=None, max_length=50)
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    labor_price: Optional[int] = Field(default=None, ge=0)
    sort_order: Optional[int] = None


class MaintenancePresetOut(BaseModel):
    id: UUID
    store_id: Optional[UUID]
    name: str
    vehicle_category: str
    duration_minutes: int
    labor_price: Optional[int]
    is_default: bool
    sort_order: int

    class Config:
        from_attributes = True
