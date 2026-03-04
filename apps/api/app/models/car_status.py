from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CarStatusMasterORM(Base):
    __tablename__ = "car_status_master"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(64), nullable=False)
    color = Column(String(16), nullable=False, default="#E5E7EB")
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (Index("ix_car_status_master_store_id", "store_id"),)
