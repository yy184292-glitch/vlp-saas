from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkReportORM(Base):
    __tablename__ = "work_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    instruction_id = Column(
        UUID(as_uuid=True),
        ForeignKey("instruction_orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    car_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cars.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(255), nullable=True)
    vehicle_category = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="in_progress")
    completed_at = Column(DateTime(timezone=True), nullable=True)
    reported_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    items = relationship(
        "WorkReportItemORM",
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="WorkReportItemORM.sort_order",
    )
    invoices = relationship(
        "InvoiceORM",
        back_populates="report",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_work_reports_store_status", "store_id", "status"),
    )


class WorkReportItemORM(Base):
    __tablename__ = "work_report_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    work_master_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_masters.id", ondelete="SET NULL"),
        nullable=True,
    )

    item_name = Column(String(255), nullable=False)
    item_type = Column(String(20), nullable=False, default="work")  # work / material
    quantity = Column(Numeric(10, 2), nullable=False, default=Decimal("1"))
    unit_price = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    duration_minutes = Column(Integer, nullable=True)
    is_checked = Column(Boolean, nullable=False, default=False)
    checked_at = Column(DateTime(timezone=True), nullable=True)
    memo = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    report = relationship("WorkReportORM", back_populates="items")

    __table_args__ = (
        Index("ix_work_report_items_report_type", "report_id", "item_type"),
    )


class InvoiceORM(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    invoice_type = Column(String(20), nullable=False, default="estimate")  # estimate / invoice
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    tax = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    total = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    notes = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft / issued

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    report = relationship("WorkReportORM", back_populates="invoices")
