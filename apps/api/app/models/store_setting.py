from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, Boolean, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StoreSettingORM(Base):
    """店舗設定（店舗ごと）

    - tax_rate: 消費税率（例 0.10）
    - auto_expense_on_stock_in: 在庫入庫時に経費（部材）を自動計上する
    """

    __tablename__ = "store_settings"

    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)

    tax_rate = Column(Numeric(5, 4), nullable=False, server_default="0.10")
    auto_expense_on_stock_in = Column(Boolean, nullable=False, server_default="true")

    # カレンダー期限計算用（日数）
    # 期限日 = 入庫日(received_at) + instruction_due_days
    instruction_due_days = Column(Integer, nullable=False, server_default="7")

    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_store_settings_store_id", "store_id"),
    )

    # 見積/請求の支払期限（店舗デフォルト）
    # type:
    #  - "days": issued_at + invoice_due_days
    #  - "eom": end_of_month(issued_at + invoice_due_months months)
    invoice_due_rule_type = Column(String(10), nullable=False, server_default="days")
    invoice_due_days = Column(Integer, nullable=False, server_default="30")
    invoice_due_months = Column(Integer, nullable=False, server_default="0")

    # 書類印刷のデフォルト受任者（店舗スタッフ）
    default_staff_id = Column(UUID(as_uuid=True), nullable=True)

    # 書類印刷の項目ON/OFF設定（JSON）
    # 例: {"ininjou": {"delegate": true, ...}, "jouto": {...}}
    print_fields = Column(JSONB, nullable=True)

    # ── 機能ON/OFFフラグ（ローン・保証・保険）────────────────────────
    loan_enabled = Column(Boolean, nullable=False, server_default="false", default=False)
    warranty_enabled = Column(Boolean, nullable=False, server_default="false", default=False)
    insurance_enabled = Column(Boolean, nullable=False, server_default="false", default=False)

    # 各機能の申込先URL・会社名（有効時のみ表示）
    loan_url = Column(String(512), nullable=True)
    loan_company_name = Column(String(128), nullable=True)
    warranty_url = Column(String(512), nullable=True)
    warranty_company_name = Column(String(128), nullable=True)
    insurance_url = Column(String(512), nullable=True)
    insurance_company_name = Column(String(128), nullable=True)
