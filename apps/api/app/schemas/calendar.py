from __future__ import annotations

from datetime import datetime, date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class InstructionOrderOut(BaseModel):
    id: UUID
    store_id: UUID
    car_id: Optional[UUID] = None

    received_at: datetime
    due_at: datetime
    status: str
    memo: Optional[str] = None

    # 画面表示用（可能なら付与）
    car_stock_no: Optional[str] = None
    car_title: Optional[str] = None

    class Config:
        from_attributes = True


class CalendarEventOut(BaseModel):
    """カレンダー帯表示用イベント"""

    id: UUID
    start: date
    end: date
    due_at: datetime
    status: str
    title: str
    memo: Optional[str] = None


class CalendarDayOut(BaseModel):
    date: date
    items: list[InstructionOrderOut]
