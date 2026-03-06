from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class AttendanceOut(BaseModel):
    id: UUID
    store_id: UUID
    user_id: UUID
    work_date: date

    clock_in: Optional[datetime] = None
    clock_in_lat: Optional[float] = None
    clock_in_lng: Optional[float] = None
    clock_in_address: Optional[str] = None

    clock_out: Optional[datetime] = None
    clock_out_lat: Optional[float] = None
    clock_out_lng: Optional[float] = None
    clock_out_address: Optional[str] = None

    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # JOIN で付加（APIレスポンス拡張用）
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceListOut(BaseModel):
    items: List[AttendanceOut]
    total: int


class ClockInRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None  # フロントで Nominatim 変換済みの住所
    note: Optional[str] = None


class ClockOutRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    address: Optional[str] = None
    note: Optional[str] = None


class AttendanceUpdate(BaseModel):
    """管理者による手動修正"""
    work_date: Optional[date] = None
    clock_in: Optional[datetime] = None
    clock_in_lat: Optional[float] = None
    clock_in_lng: Optional[float] = None
    clock_in_address: Optional[str] = None
    clock_out: Optional[datetime] = None
    clock_out_lat: Optional[float] = None
    clock_out_lng: Optional[float] = None
    clock_out_address: Optional[str] = None
    note: Optional[str] = None
