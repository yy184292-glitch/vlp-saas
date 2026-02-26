from __future__ import annotations

import uuid
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped

from app.models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BillingSequenceORM(Base):
    """
    billing_sequences テーブル ORM

    migration側の仕様：
    - id UUID PRIMARY KEY
    - store_id, year, kind UNIQUE
    """

    __tablename__ = "billing_sequences"

    # ★主キー（UUID自動生成）
    id: Mapped[UUID] = Column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )

    # store_id
    store_id: Mapped[UUID] = Column(
        PG_UUID(as_uuid=True),
        nullable=False,
    )

    # 年
    year: Mapped[int] = Column(
        Integer,
        nullable=False,
    )

    # 種類（estimate / invoice）
    kind: Mapped[str] = Column(
        String(32),
        nullable=False,
    )

    # 次の番号
    next_no: Mapped[int] = Column(
        Integer,
        nullable=False,
        default=1,
    )

    # 作成日時
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
    )

    # 更新日時
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    # ★store_id, year, kind は UNIQUE（複合PKではなくUniqueConstraint）
    __table_args__ = (
        UniqueConstraint(
            "store_id",
            "year",
            "kind",
            name="uq_billing_sequences_store_year_kind",
        ),
    )
