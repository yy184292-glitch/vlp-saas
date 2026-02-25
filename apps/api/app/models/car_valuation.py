from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class CarValuation(Base):
    __tablename__ = "car_valuations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    car_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 査定結果（保存）
    buy_price = Column(Integer, nullable=False)
    sell_price = Column(Integer, nullable=False)
    profit = Column(Integer, nullable=False)
    profit_rate = Column(Float, nullable=False)

    # 市場価格レンジ（追加）
    market_low = Column(Integer, nullable=True)
    market_median = Column(Integer, nullable=True)
    market_high = Column(Integer, nullable=True)

    # 査定日時
    valuation_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )
