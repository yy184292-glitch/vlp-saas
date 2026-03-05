from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
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
