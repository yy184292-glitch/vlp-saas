# app/models/expense.py
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExpenseORM(Base):
    """経費

    店舗（store_id）単位で管理する経費データ。
    - amount: 税込/税抜の区別は現状UI側で扱いやすいよう「金額そのまま」を保存（将来拡張可能）
    - expense_date: 発生日（会計/集計の軸）
    """

    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    expense_date = Column(Date, nullable=False, index=True)

    # 例: 旅費交通費 / 消耗品費 / 外注費 / 通信費 ... など（自由入力でも良い）
    category = Column(String(64), nullable=False, index=True)

    title = Column(String(255), nullable=False, index=True)
    vendor = Column(String(255), nullable=True, index=True)

    # 金額（円）。小数は許容するが通常は整数運用。
    amount = Column(Numeric(14, 2), nullable=False, default=Decimal("0"))

    payment_method = Column(String(64), nullable=True)  # 現金/カード/振込 等
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    store = relationship("StoreORM", lazy="selectin")

    __table_args__ = (
        Index("ix_expenses_store_date", "store_id", "expense_date"),
        Index("ix_expenses_store_category", "store_id", "category"),
        Index("ix_expenses_store_title", "store_id", "title"),
    )
