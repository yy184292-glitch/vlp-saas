from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AssetORM(Base):
    """
    店舗に紐づくバイナリ資産（ロゴ/印影など）。
    この実装ではDBにはパスだけ持ち、実ファイルはストレージに置く想定。
    """

    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # logo / stamp など
    kind = Column(String(16), nullable=False)

    content_type = Column(String(128), nullable=True)
    file_path = Column(String(1024), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    __table_args__ = (
        Index("ix_assets_store_kind", "store_id", "kind"),
    )