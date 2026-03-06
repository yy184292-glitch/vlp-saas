from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class LineSettingORM(Base):
    """店舗ごとの LINE Messaging API 設定"""
    __tablename__ = "line_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    channel_access_token = Column(Text, nullable=True)   # LINE Messaging API チャネルアクセストークン
    channel_secret = Column(String(64), nullable=True)   # 署名検証用シークレット
    liff_id = Column(String(64), nullable=True)          # LIFF アプリID（nullable）

    auto_reply_enabled = Column(Boolean, nullable=False, default=False)
    auto_reply_message = Column(Text, nullable=True)     # 自動返信メッセージ
    welcome_message = Column(Text, nullable=True)        # 友だち追加時メッセージ

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
