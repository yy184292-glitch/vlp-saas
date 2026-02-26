from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID as PyUUID

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    Float,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base


Base = declarative_base()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BillingDocumentORM(Base):

    __tablename__ = "billing_documents"

    # 主キー
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # 店舗
    store_id = Column(UUID(as_uuid=True), nullable=True)

    # estimate / invoice
    kind = Column(String, nullable=False)

    # draft / issued / void
    status = Column(String, nullable=False)

    # ★採番（必須）
    doc_no = Column(String(32), nullable=True)

    customer_name = Column(String, nullable=True)

    subtotal = Column(Integer, nullable=False)
    tax_total = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)

    # ★税設定（必須）
    tax_rate = Column(Numeric(5, 4), nullable=False, default=Decimal("0.10"))
    tax_mode = Column(String(16), nullable=False, default="exclusive")
    tax_rounding = Column(String(16), nullable=False, default="floor")

    issued_at = Column(DateTime(timezone=True), nullable=True)

    source_work_order_id = Column(UUID(as_uuid=True), nullable=True)

    meta = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("doc_no", name="uq_billing_documents_doc_no"),
    )


class BillingLineORM(Base):

    __tablename__ = "billing_lines"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    billing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("billing_documents.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String, nullable=False)

    qty = Column(Float, nullable=False)

    unit = Column(String, nullable=True)

    unit_price = Column(Integer, nullable=False)

    # convert で必ず使う
    cost_price = Column(Integer, nullable=False, default=0)

    amount = Column(Integer, nullable=False, default=0)

    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )
