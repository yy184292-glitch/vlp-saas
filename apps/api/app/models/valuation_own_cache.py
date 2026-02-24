from __future__ import annotations

import uuid
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ValuationOwnCache(Base):
    __tablename__ = "valuation_own_cache"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False
    )

    make: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[str] = mapped_column(String, nullable=False)
    year_center: Mapped[int] = mapped_column(Integer, nullable=False)
    mileage_bucket: Mapped[str] = mapped_column(String, nullable=False)

    own_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    own_median_price: Mapped[int | None] = mapped_column(Integer, nullable=True)

    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
