from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

LicensePlan = Literal["starter", "standard", "pro"]
LicenseStatus = Literal["trial", "active", "expired", "suspended"]


class LicenseCreate(BaseModel):
    store_name: str = Field(..., min_length=1, max_length=255)
    admin_email: str = Field(..., min_length=1, max_length=255)
    admin_name: str = Field(default="管理者", max_length=255)
    plan: LicensePlan = "starter"
    trial_days: int = Field(default=30, ge=1, le=365)
    notes: Optional[str] = None


class LicenseUpdate(BaseModel):
    plan: Optional[LicensePlan] = None
    status: Optional[LicenseStatus] = None
    trial_ends_at: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    notes: Optional[str] = None


class LicenseOut(BaseModel):
    id: UUID
    store_id: UUID
    store_name: str
    plan: LicensePlan
    status: LicenseStatus
    trial_ends_at: Optional[datetime]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LicenseCreateOut(BaseModel):
    license: LicenseOut
    store_id: str
    admin_email: str
    initial_password: str
    message: str
