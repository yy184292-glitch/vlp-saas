from __future__ import annotations

import uuid
from sqlalchemy import String, Integer, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class ValuationSettings(Base):
    __tablename__ = "valuation_settings"

    # 1店舗1レコード
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        primary_key=True,
    )

    provider: Mapped[str] = mapped_column(String, nullable=False, server_default="MAT")

    display_adjust_pct: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, server_default="0")
    buy_cap_pct: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, server_default="0.92")

    recommended_from_cap_yen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="40000")
    risk_buffer_yen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="30000")
    round_unit_yen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="10000")
    default_extra_cost_yen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="30000")
    min_profit_yen: Mapped[int] = mapped_column(Integer, nullable=False, server_default="50000")
    min_profit_rate: Mapped[float] = mapped_column(Numeric(7, 4), nullable=False, server_default="0.08")

    created_at = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
