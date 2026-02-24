import uuid
from sqlalchemy import String, Integer, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.sql import func

from app.db.base import Base


class ValuationSettings(Base):

    __tablename__ = "valuation_settings"

    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        primary_key=True,
    )

    provider: Mapped[str] = mapped_column(String, nullable=False, default="MAT")

    buy_cap_pct: Mapped[float] = mapped_column(
        Numeric(7, 4),
        nullable=False,
        default=0.92,
    )

    risk_buffer_yen: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=30000,
    )

    created_at = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
