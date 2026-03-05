from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MaintenancePresetORM(Base):
    """整備作業プリセット

    - store_id=NULL: システム共通デフォルト（全店舗に表示）
    - store_id=<uuid>: 店舗固有カスタムプリセット
    """

    __tablename__ = "maintenance_presets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    name = Column(String(255), nullable=False)
    vehicle_category = Column(String(50), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    labor_price = Column(Integer, nullable=True)
    is_default = Column(Boolean, nullable=False, server_default="true")
    sort_order = Column(Integer, nullable=False, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_maintenance_presets_store_category", "store_id", "vehicle_category"),
    )
