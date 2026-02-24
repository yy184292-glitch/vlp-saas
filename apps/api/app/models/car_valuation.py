from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.models.base import Base


class CarValuation(Base):
    """
    査定履歴テーブル
    cars は「最新状態」
    car_valuations は「履歴」
    """

    __tablename__ = "car_valuations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    car_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True,
    )

    # 査定結果（スナップショット）
    buy_price = Column(Integer, nullable=False)
    sell_price = Column(Integer, nullable=False)
    profit = Column(Integer, nullable=False)
    profit_rate = Column(Float, nullable=False)

    valuation_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
