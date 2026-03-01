from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkCreateIn(BaseModel):
    store_id: UUID

    code: Optional[str] = Field(default=None, max_length=64)
    name: str = Field(..., max_length=255)

    unit: Optional[str] = Field(default=None, max_length=32)

    # Numeric(12,2) 想定。APIは Decimal で受けるのが安全
    unit_price: Decimal = Field(default=Decimal("0"))

    note: Optional[str] = None


class WorkUpdateIn(BaseModel):
    code: Optional[str] = Field(default=None, max_length=64)
    name: Optional[str] = Field(default=None, max_length=255)

    unit: Optional[str] = Field(default=None, max_length=32)
    unit_price: Optional[Decimal] = None

    note: Optional[str] = None


class WorkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID

    code: Optional[str] = None
    name: str

    unit: Optional[str] = None
    unit_price: Decimal

    note: Optional[str] = None

    created_at: datetime
    updated_at: datetime