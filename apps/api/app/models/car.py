from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.models.base import Base


class Car(Base):
    __tablename__ = "cars"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    stock_no = Column(String, nullable=False, index=True)

    make = Column(String, nullable=False)
    maker = Column(String, nullable=True)
    model = Column(String, nullable=False)
    grade = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    mileage = Column(Integer, nullable=True)

    vin = Column(String, nullable=True)
    model_code = Column(String, nullable=True)
    color = Column(String, nullable=True)

    expected_buy_price = Column(Integer, nullable=True)
    expected_sell_price = Column(Integer, nullable=True)
    expected_profit = Column(Integer, nullable=True)
    expected_profit_rate = Column(Float, nullable=True)
    valuation_at = Column(DateTime(timezone=True), nullable=True)

　　from datetime import datetime, timezone  # 既にあれば不要

　　created_at = Column(
  　　  DateTime(timezone=True),
  　　  nullable=False,
  　　  default=lambda: datetime.now(timezone.utc),
   　　 server_default=func.now(),
　　)

    
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
