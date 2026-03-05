from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


WORK_CATEGORIES = [
    "軽整備", "足回り", "冷却系", "重整備",
    "電装・カー用品", "故障診断", "板金・外装", "エアコン", "定期点検",
]

VEHICLE_CATEGORIES = [
    "軽自動車",
    "普通乗用車小型",
    "普通乗用車中大型",
    "トラック小型2t以下",
    "トラック中型2t超3以下8t以下",
    "トラック大型8t超",
]


class WorkMasterRateOut(BaseModel):
    id: UUID
    vehicle_category: str
    duration_minutes: int
    price: Optional[int]

    class Config:
        from_attributes = True


class WorkMasterOut(BaseModel):
    id: UUID
    work_name: str
    work_category: str
    store_id: Optional[UUID]
    is_active: bool
    sort_order: int
    rates: List[WorkMasterRateOut] = []

    class Config:
        from_attributes = True


class WorkMasterRateInput(BaseModel):
    vehicle_category: str = Field(..., max_length=50)
    duration_minutes: int = Field(..., ge=1)
    price: Optional[int] = Field(default=None, ge=0)


class WorkMasterCreate(BaseModel):
    work_name: str = Field(..., min_length=1, max_length=255)
    work_category: str = Field(..., max_length=50)
    sort_order: int = Field(default=0)
    rates: List[WorkMasterRateInput] = []


class WorkMasterUpdate(BaseModel):
    work_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    work_category: Optional[str] = Field(default=None, max_length=50)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    rates: Optional[List[WorkMasterRateInput]] = None


class WorkMasterForVehicle(BaseModel):
    """by-vehicle-category エンドポイント用のフラットな返却形式"""
    id: UUID
    work_name: str
    work_category: str
    store_id: Optional[UUID]
    is_active: bool
    sort_order: int
    duration_minutes: int
    price: Optional[int]

    class Config:
        from_attributes = True
