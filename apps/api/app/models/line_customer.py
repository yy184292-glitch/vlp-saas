from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class LineCustomerORM(Base):
    """LINE ユーザーと既存顧客の紐付けテーブル"""
    __tablename__ = "line_customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)

    # 既存顧客との紐付け（nullable: 未紐付けの友達も保持）
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

    # LINE プロフィール
    line_user_id = Column(String(128), nullable=False, index=True)  # LINE の U+32桁
    display_name = Column(String(256), nullable=True)
    picture_url = Column(Text, nullable=True)

    # フォロー状態
    follow_status = Column(String(16), nullable=False, default="following")  # following / blocked / unknown
    followed_at = Column(DateTime(timezone=True), nullable=True)
    blocked_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
