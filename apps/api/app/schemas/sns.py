from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── SNS Settings ────────────────────────────────────────────

class SnsSettingOut(BaseModel):
    id: UUID
    store_id: UUID

    twitter_enabled: bool
    twitter_api_key: Optional[str] = None
    twitter_api_secret: Optional[str] = None
    twitter_access_token: Optional[str] = None
    twitter_access_secret: Optional[str] = None

    instagram_enabled: bool
    instagram_account_id: Optional[str] = None
    instagram_access_token: Optional[str] = None

    line_enabled: bool
    line_channel_token: Optional[str] = None
    line_channel_secret: Optional[str] = None

    auto_new_arrival: bool
    auto_price_down: bool
    auto_sold_out: bool

    new_arrival_template: str
    price_down_template: str
    sold_out_template: str

    repost_enabled: bool
    repost_interval_weeks: int
    repost_platforms: Optional[List[str]] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SnsSettingUpdate(BaseModel):
    twitter_enabled: Optional[bool] = None
    twitter_api_key: Optional[str] = None
    twitter_api_secret: Optional[str] = None
    twitter_access_token: Optional[str] = None
    twitter_access_secret: Optional[str] = None

    instagram_enabled: Optional[bool] = None
    instagram_account_id: Optional[str] = None
    instagram_access_token: Optional[str] = None

    line_enabled: Optional[bool] = None
    line_channel_token: Optional[str] = None
    line_channel_secret: Optional[str] = None

    auto_new_arrival: Optional[bool] = None
    auto_price_down: Optional[bool] = None
    auto_sold_out: Optional[bool] = None

    new_arrival_template: Optional[str] = None
    price_down_template: Optional[str] = None
    sold_out_template: Optional[str] = None

    repost_enabled: Optional[bool] = None
    repost_interval_weeks: Optional[int] = Field(None, ge=1, le=12)
    repost_platforms: Optional[List[str]] = None


# ─── SNS Posts ───────────────────────────────────────────────

class SnsPostOut(BaseModel):
    id: UUID
    store_id: UUID
    car_id: Optional[UUID] = None

    trigger: str
    platform: str
    status: str

    caption: str
    image_urls: Optional[List[str]] = None
    posted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    repost_count: int

    created_at: datetime

    class Config:
        from_attributes = True


class SnsPostCreate(BaseModel):
    car_id: Optional[UUID] = None
    trigger: str = "manual"
    platform: str = "all"
    caption: str
    image_urls: Optional[List[str]] = None


class SnsPostListOut(BaseModel):
    items: List[SnsPostOut]
    total: int


# ─── Preview ─────────────────────────────────────────────────

class SnsPreviewOut(BaseModel):
    trigger: str
    caption: str


# ─── Repost Schedule ─────────────────────────────────────────

class RepostScheduleItem(BaseModel):
    car_id: UUID
    car_name: str
    last_posted_at: datetime
    next_repost_at: datetime
    overdue: bool
