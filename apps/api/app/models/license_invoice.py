from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LicenseInvoiceORM(Base):
    __tablename__ = "license_invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    license_id = Column(
        UUID(as_uuid=True),
        ForeignKey("licenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # INV-YYYY-NNNN
    invoice_number = Column(String(32), nullable=False, unique=True)

    # invoice / receipt
    type = Column(String(16), nullable=False, server_default="invoice")

    # monthly / yearly
    billing_cycle = Column(String(16), nullable=False, server_default="monthly")

    amount = Column(Integer(), nullable=False)        # 税抜金額
    tax_amount = Column(Integer(), nullable=False)    # 消費税額
    total_amount = Column(Integer(), nullable=False)  # 税込合計

    period_from = Column(Date(), nullable=True)
    period_to = Column(Date(), nullable=True)

    issued_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(Date(), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # draft / issued / paid / cancelled
    status = Column(String(16), nullable=False, server_default="draft")

    note = Column(Text(), nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default="NOW()"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default="NOW()",
        onupdate=_utcnow,
    )
