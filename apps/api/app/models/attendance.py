from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class AttendanceORM(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("store_id", "user_id", "work_date", name="uq_attendance_user_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    work_date = Column(Date, nullable=False)

    # 出勤
    clock_in = Column(DateTime(timezone=True), nullable=True)
    clock_in_lat = Column(Float, nullable=True)
    clock_in_lng = Column(Float, nullable=True)
    clock_in_address = Column(Text, nullable=True)

    # 退勤
    clock_out = Column(DateTime(timezone=True), nullable=True)
    clock_out_lat = Column(Float, nullable=True)
    clock_out_lng = Column(Float, nullable=True)
    clock_out_address = Column(Text, nullable=True)

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
