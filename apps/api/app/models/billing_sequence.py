from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BillingSequenceORM(Base):
    """
    採番テーブル: billing_sequences

    - store_id + year + kind が一意
    - next_no を SELECT FOR UPDATE でロックして安全にインクリメントする
    """

    __tablename__ = "billing_sequences"

    store_id: Mapped[UUID] = Column(PG_UUID(as_uuid=True), primary_key=True, nullable=False)
    year: Mapped[int] = Column(Integer, primary_key=True, nullable=False)
    kind: Mapped[str] = Column(String(32), primary_key=True, nullable=False)  # "invoice" / "estimate"

    next_no: Mapped[int] = Column(Integer, nullable=False, default=1)

    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=_utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow)


# NOTE:
# String import を忘れると NameError になるので最後に置く（循環回避）
from sqlalchemy import String  # noqa: E402
