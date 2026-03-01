from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    """UTC now (timezone aware)"""
    return datetime.now(timezone.utc)


# ============================================================
# billing_documents
# ============================================================

class BillingDocumentORM(Base):
    __tablename__ = "billing_documents"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    # --------------------------------------------------------
    # foreign keys
    # --------------------------------------------------------

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --------------------------------------------------------
    # basic info
    # --------------------------------------------------------

    kind = Column(
        String(32),
        nullable=False,
        index=True,
        comment="estimate / invoice",
    )

    status = Column(
        String(32),
        nullable=False,
        index=True,
        comment="draft / issued / void",
    )

    doc_no = Column(
        String(32),
        nullable=True,
        index=True,
    )

    # snapshot（顧客名）
    customer_name = Column(
        String,
        nullable=True,
    )

    # --------------------------------------------------------
    # money
    # --------------------------------------------------------

    subtotal = Column(
        Integer,
        nullable=False,
        default=0,
    )

    tax_total = Column(
        Integer,
        nullable=False,
        default=0,
    )

    total = Column(
        Integer,
        nullable=False,
        default=0,
    )

    tax_rate = Column(
        Numeric(5, 4),
        nullable=False,
        default=Decimal("0.10"),
    )

    tax_mode = Column(
        String(16),
        nullable=False,
        default="exclusive",
    )

    tax_rounding = Column(
        String(16),
        nullable=False,
        default="floor",
    )

    issued_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    source_work_order_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    meta = Column(
        JSON,
        nullable=False,
        default=dict,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        index=True,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    # --------------------------------------------------------
    # relationships
    # --------------------------------------------------------

    lines = relationship(
        "BillingLineORM",
        back_populates="document",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )

    store = relationship(
        "StoreORM",
        lazy="selectin",
    )

    customer = relationship(
        "CustomerORM",
        lazy="selectin",
    )

    __table_args__ = (

        UniqueConstraint(
            "store_id",
            "doc_no",
            name="uq_billing_documents_store_doc_no",
        ),

        Index(
            "ix_billing_documents_store_kind_status",
            "store_id",
            "kind",
            "status",
        ),

        Index(
            "ix_billing_documents_store_customer",
            "store_id",
            "customer_id",
        ),
    )


# ============================================================
# billing_lines
# ============================================================

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
        ForeignKey(
            "billing_documents.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # NEW: 作業マスタ連動（任意）
    work_id = Column(
        UUID(as_uuid=True),
        ForeignKey(
            "works.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # snapshot fields（マスタ変更耐性）
    name = Column(
        String,
        nullable=False,
    )

    qty = Column(
        Float,
        nullable=False,
    )

    unit = Column(
        String,
        nullable=True,
    )

    unit_price = Column(
        Integer,
        nullable=False,
    )

    cost_price = Column(
        Integer,
        nullable=False,
        default=0,
    )

    amount = Column(
        Integer,
        nullable=False,
        default=0,
    )

    sort_order = Column(
        Integer,
        nullable=False,
        default=0,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        index=True,
    )

    # relationships
    document = relationship(
        "BillingDocumentORM",
        back_populates="lines",
        lazy="selectin",
    )

    # NEW: 作業マスタ参照
    work = relationship(
        "WorkORM",
        lazy="selectin",
    )

    __table_args__ = (
        Index(
            "ix_billing_lines_billing_sort",
            "billing_id",
            "sort_order",
        ),
        Index(
            "ix_billing_lines_work",
            "work_id",
        ),
    )