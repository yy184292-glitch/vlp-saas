from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExpenseAttachmentORM(Base):
    """経費 添付ファイル（領収書等）

    - 保存先はサーバーのローカルパス（まずは簡単に運用）
    - 本番でS3等へ移行しやすいよう path を抽象化
    """

    __tablename__ = "expense_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False, index=True)

    filename = Column(String(255), nullable=False)
    content_type = Column(String(128), nullable=False)
    storage_path = Column(String(512), nullable=False)  # サーバー上の保存パス
    size_bytes = Column(String(32), nullable=True)

    ocr_text = Column(Text, nullable=True)
    ocr_lang = Column(String(32), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    expense = relationship("ExpenseORM", lazy="selectin")

    __table_args__ = (
        Index("ix_exp_attach_store_expense", "store_id", "expense_id"),
    )
