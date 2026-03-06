from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ─── 代車マスタ ────────────────────────────────────────────────

class LoanerCarCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    plate_no: Optional[str] = Field(default=None, max_length=32)
    color: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None


class LoanerCarUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    plate_no: Optional[str] = Field(default=None, max_length=32)
    color: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None
    is_active: Optional[bool] = None


class LoanerCarOut(BaseModel):
    id: UUID
    store_id: UUID
    name: str
    plate_no: Optional[str]
    color: Optional[str]
    note: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── 代車予約 ────────────────────────────────────────────────────

class LoanerReservationCreate(BaseModel):
    loaner_car_id: UUID
    customer_name: Optional[str] = Field(default=None, max_length=255)
    start_date: date
    end_date: date
    note: Optional[str] = None

    @model_validator(mode="after")
    def check_dates(self) -> "LoanerReservationCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date は start_date 以降にしてください")
        return self


class LoanerReservationUpdate(BaseModel):
    customer_name: Optional[str] = Field(default=None, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    note: Optional[str] = None

    @model_validator(mode="after")
    def check_dates(self) -> "LoanerReservationUpdate":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date は start_date 以降にしてください")
        return self


class LoanerReservationOut(BaseModel):
    id: UUID
    store_id: UUID
    loaner_car_id: UUID
    customer_name: Optional[str]
    start_date: date
    end_date: date
    note: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
