from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Float, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timezone

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
    status = Column(String, nullable=False, server_default="在庫")

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

    # =========================================================
    # 海外公開（export）
    # =========================================================
    export_enabled = Column(Boolean, nullable=False, server_default="false")
    export_price = Column(Integer, nullable=True)
    export_status = Column(String, nullable=True)
    export_image_url = Column(String, nullable=True)
    export_description = Column(Text, nullable=True)

    # --- 書類印刷用（委任状/譲渡証明） ---
    owner_name = Column(String, nullable=True)
    owner_name_kana = Column(String, nullable=True)
    owner_postal_code = Column(String, nullable=True)
    owner_address1 = Column(String, nullable=True)
    owner_address2 = Column(String, nullable=True)
    owner_tel = Column(String, nullable=True)

    new_owner_name = Column(String, nullable=True)
    new_owner_name_kana = Column(String, nullable=True)
    new_owner_postal_code = Column(String, nullable=True)
    new_owner_address1 = Column(String, nullable=True)
    new_owner_address2 = Column(String, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
    )
