from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

SalesMode = Literal["exclusive", "inclusive"]


class ProfitSummaryOut(BaseModel):
    date_from: date
    date_to: date
    sales: int = Field(ge=0)
    cost: int = Field(ge=0)
    profit: int
    margin_rate: float


class ProfitDailyRowOut(BaseModel):
    day: date
    sales: int = Field(ge=0)
    cost: int = Field(ge=0)
    profit: int


class ProfitDailyOut(BaseModel):
    date_from: date
    date_to: date
    rows: list[ProfitDailyRowOut]


class ProfitMonthlyRowOut(BaseModel):
    month: date  # 月初日（例: 2026-02-01）
    sales: int = Field(ge=0)
    cost: int = Field(ge=0)
    profit: int


class ProfitMonthlyOut(BaseModel):
    date_from: date
    date_to: date
    rows: list[ProfitMonthlyRowOut]


class ProfitByWorkRowOut(BaseModel):
    work_id: UUID
    work_name: str
    sales: int = Field(ge=0)
    cost: int = Field(ge=0)
    profit: int


class ProfitByWorkOut(BaseModel):
    date_from: date
    date_to: date
    rows: list[ProfitByWorkRowOut]


class CostByItemRowOut(BaseModel):
    item_id: UUID
    item_name: str
    qty: float
    cost: int = Field(ge=0)


class CostByItemOut(BaseModel):
    date_from: date
    date_to: date
    rows: list[CostByItemRowOut]


class DashboardSummaryOut(BaseModel):
    date_from: date
    date_to: date
    sales: int = Field(ge=0)
    cost: int = Field(ge=0)
    profit: int
    margin_rate: float
    issued_count: int = Field(ge=0)
    inventory_value: int = Field(ge=0)