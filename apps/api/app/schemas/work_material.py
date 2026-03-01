# app/schemas/work_material.py
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkMaterialCreateIn(BaseModel):
    store_id: UUID
    work_id: UUID
    item_id: UUID

    qty_per_work: Decimal = Field(..., gt=Decimal("0"))


class WorkMaterialUpdateIn(BaseModel):
    qty_per_work: Optional[Decimal] = Field(default=None, gt=Decimal("0"))


class WorkMaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    store_id: UUID
    work_id: UUID
    item_id: UUID

    qty_per_work: Decimal

    created_at: datetime
    updated_at: datetime