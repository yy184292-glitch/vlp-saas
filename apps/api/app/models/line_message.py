from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class LineMessageORM(Base):
    """LINE メッセージ送受信履歴"""
    __tablename__ = "line_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    line_customer_id = Column(UUID(as_uuid=True), ForeignKey("line_customers.id", ondelete="CASCADE"), nullable=False, index=True)

    direction = Column(String(8), nullable=False)    # inbound / outbound
    message_type = Column(String(16), nullable=False, default="text")  # text / image / sticker / other
    content = Column(Text, nullable=True)            # テキスト内容

    line_message_id = Column(String(128), nullable=True)  # LINE 側のメッセージID（inboundのみ）

    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
