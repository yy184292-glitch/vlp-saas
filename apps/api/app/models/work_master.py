from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkMasterORM(Base):
    __tablename__ = "work_masters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_name = Column(String(255), nullable=False)
    work_category = Column(String(50), nullable=False)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now(), onupdate=func.now())

    rates = relationship("WorkMasterRateORM", back_populates="work_master", cascade="all, delete-orphan", lazy="select")


class WorkMasterRateORM(Base):
    __tablename__ = "work_master_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_master_id = Column(UUID(as_uuid=True), ForeignKey("work_masters.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_category = Column(String(50), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    price = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now(), onupdate=func.now())

    work_master = relationship("WorkMasterORM", back_populates="rates")

    __table_args__ = (
        Index("ix_work_master_rates_wm_vc", "work_master_id", "vehicle_category"),
    )
