from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

PartnerRank = Literal["silver", "gold", "platinum"]
ServiceType = Literal["own", "partner"]  # None は nullable で表現


class PartnerCreate(BaseModel):
    store_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    rank: PartnerRank = "silver"
    loan_type: Optional[ServiceType] = None
    insurance_type: Optional[ServiceType] = None
    warranty_type: Optional[ServiceType] = None


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[PartnerRank] = None
    loan_type: Optional[ServiceType] = None
    insurance_type: Optional[ServiceType] = None
    warranty_type: Optional[ServiceType] = None
    is_active: Optional[bool] = None


class PartnerOut(BaseModel):
    id: UUID
    store_id: UUID
    store_name: str
    code: str
    name: str
    rank: PartnerRank
    rank_updated_at: Optional[datetime]
    loan_type: Optional[str]
    insurance_type: Optional[str]
    warranty_type: Optional[str]
    is_active: bool
    referral_count: int = 0      # 紹介した店舗数（activeなreferral）
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartnerStats(BaseModel):
    partner_id: UUID
    active_referrals: int
    pending_referrals: int
    total_discount_generated: int   # 紹介により発生した合計割引額（円）
    monthly_discount: int           # 今月の紹介による割引額
