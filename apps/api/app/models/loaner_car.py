from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LoanerCarORM(Base):
    """代車マスタ"""

    __tablename__ = "loaner_cars"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    plate_no = Column(String(32), nullable=True)
    color = Column(String(64), nullable=True)
    note = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    reservations = relationship(
        "LoanerReservationORM",
        back_populates="loaner_car",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )


class LoanerReservationORM(Base):
    """代車予約"""

    __tablename__ = "loaner_reservations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    loaner_car_id = Column(
        UUID(as_uuid=True),
        ForeignKey("loaner_cars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_name = Column(String(255), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    loaner_car = relationship("LoanerCarORM", back_populates="reservations")

    __table_args__ = (
        Index("ix_loaner_reservations_car_dates", "loaner_car_id", "start_date", "end_date"),
    )
