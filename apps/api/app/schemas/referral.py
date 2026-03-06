from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

REFERRAL_DISCOUNT_PER_ACTIVE = 1_000  # activeな紹介1件あたりの月次割引額（円）

# パートナーランク昇格の閾値（active referrals数）
RANK_THRESHOLDS = {"silver": 3, "gold": 10, "platinum": 20}


class ReferralOut(BaseModel):
    id: UUID
    referrer_store_id: UUID
    referrer_store_name: str
    referred_store_id: UUID
    referred_store_name: str
    referral_code: str
    partner_id: Optional[UUID]
    status: str
    activated_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class MyDiscountOut(BaseModel):
    active_referrals: int
    monthly_discount: int       # 月次割引額合計
    monthly_price_before: int   # 割引前の月額料金
    monthly_price_after: int    # 割引後の月額料金（0以上）
    free_slots_needed: int      # あと何人で0円になるか（0の場合はすでに0円）
