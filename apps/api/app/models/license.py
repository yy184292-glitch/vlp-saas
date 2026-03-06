from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LicenseORM(Base):
    __tablename__ = "licenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # starter / standard / pro
    plan = Column(String(32), nullable=False, server_default="starter")

    # trial / active / expired / suspended
    status = Column(String(32), nullable=False, server_default="trial")

    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)

    # monthly / yearly
    billing_cycle = Column(String(16), nullable=False, server_default="monthly")
    next_billing_date = Column(Date(), nullable=True)

    # 紹介コード（登録時に入力した他店舗の紹介コード）
    referral_code = Column(String(32), nullable=True)
    # 毎月の紹介割引額（active referral 数 × 1,000円）
    referral_discount = Column(Integer(), nullable=False, server_default="0", default=0)
    # パートナー経由の場合
    partner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("partners.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Stripe フィールド
    stripe_customer_id = Column(String(128), nullable=True)
    stripe_subscription_id = Column(String(128), nullable=True)
    stripe_payment_method_id = Column(String(128), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default="NOW()"
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        server_default="NOW()",
        onupdate=_utcnow,
    )
