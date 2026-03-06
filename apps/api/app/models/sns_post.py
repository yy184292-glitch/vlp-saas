from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.models.base import Base


class SnsSettingORM(Base):
    __tablename__ = "sns_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Twitter
    twitter_enabled = Column(Boolean, nullable=False, default=False)
    twitter_api_key = Column(String, nullable=True)
    twitter_api_secret = Column(String, nullable=True)
    twitter_access_token = Column(String, nullable=True)
    twitter_access_secret = Column(String, nullable=True)

    # Instagram
    instagram_enabled = Column(Boolean, nullable=False, default=False)
    instagram_account_id = Column(String, nullable=True)
    instagram_access_token = Column(String, nullable=True)

    # LINE
    line_enabled = Column(Boolean, nullable=False, default=False)
    line_channel_token = Column(String, nullable=True)
    line_channel_secret = Column(String, nullable=True)

    # 自動投稿トリガー
    auto_new_arrival = Column(Boolean, nullable=False, default=True)
    auto_price_down = Column(Boolean, nullable=False, default=True)
    auto_sold_out = Column(Boolean, nullable=False, default=True)

    # テンプレート
    new_arrival_template = Column(
        Text, nullable=False,
        default="【新着】{car_name} {year}年式 走行{mileage}km ¥{price}\n{store_name}",
    )
    price_down_template = Column(
        Text, nullable=False,
        default="【値下げ】{car_name} {year}年式 → ¥{price}\n{store_name}",
    )
    sold_out_template = Column(
        Text, nullable=False,
        default="【SOLD OUT】{car_name} {year}年式\nありがとうございました！\n{store_name}",
    )

    # 定期再投稿
    repost_enabled = Column(Boolean, nullable=False, default=False)
    repost_interval_weeks = Column(Integer, nullable=False, default=2)
    repost_platforms = Column(JSON, nullable=True)  # e.g. ["twitter", "line"]

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class SnsPostORM(Base):
    __tablename__ = "sns_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    car_id = Column(UUID(as_uuid=True), ForeignKey("cars.id", ondelete="SET NULL"), nullable=True, index=True)

    # new_arrival / price_down / sold_out / manual / repost
    trigger = Column(String(50), nullable=False)
    # twitter / instagram / line / all
    platform = Column(String(50), nullable=False, default="all")
    # pending / posted / failed / skipped
    status = Column(String(20), nullable=False, default="pending")

    caption = Column(Text, nullable=False)
    image_urls = Column(JSON, nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    repost_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
