from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Column, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class WorkORM(Base):
    """
    作業マスタ（見積/請求の明細元）

    - store_id: 店舗/事業所単位で作業メニューを分ける想定
    - code: 任意の管理コード（例: OILCHANGE）
    - name: 表示名（明細の品目にコピーされる）
    - unit: 単位（例: 式 / 時間 / 個）
    - unit_price: 単価（明細の単価にコピーされる）
    - note: 補足（任意）
    """

    __tablename__ = "works"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code = Column(String(64), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)

    unit = Column(String(32), nullable=True)

    unit_price = Column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
    )

    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    # optional relation (親側に back_populates 無くても動く)
    store = relationship("StoreORM", lazy="selectin")

    __table_args__ = (
        Index("ix_works_store_name", "store_id", "name"),
        Index("ix_works_store_code", "store_id", "code"),
    )