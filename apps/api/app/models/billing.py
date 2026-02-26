from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    Float,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class BillingDocumentORM(Base):

    __tablename__ = "billing_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(UUID(as_uuid=True), nullable=True)

    kind = Column(String, nullable=False)

    status = Column(String, nullable=False)

    customer_name = Column(String, nullable=True)

    subtotal = Column(Integer, nullable=False)

    tax_total = Column(Integer, nullable=False)

    total = Column(Integer, nullable=False)

    issued_at = Column(DateTime(timezone=True), nullable=True)

    source_work_order_id = Column(UUID(as_uuid=True), nullable=True)

    meta = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False)

    updated_at = Column(DateTime(timezone=True), nullable=False)



from sqlalchemy import Numeric, String
from decimal import Decimal

doc_no = Column(String(32), nullable=True)
tax_rate = Column(Numeric(5, 4), nullable=False, default=Decimal("0.10"))
tax_mode = Column(String(16), nullable=False, default="exclusive")
tax_rounding = Column(String(16), nullable=False, default="floor")

class BillingLineORM(Base):

    __tablename__ = "billing_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    billing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("billing_documents.id", ondelete="CASCADE"),
        nullable=False,
    )

    name = Column(String, nullable=False)

    qty = Column(Float, nullable=False)

    unit = Column(String, nullable=True)

    unit_price = Column(Integer, nullable=False)

    cost_price = Column(Integer, nullable=False)

    amount = Column(Integer, nullable=False)

    sort_order = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False)
