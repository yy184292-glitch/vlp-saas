from __future__ import annotations

from sqlalchemy import Column, DateTime, JSON, String, text

from app.db.base import Base  # ← あなたのプロジェクトのBaseを使用


class SystemSettingORM(Base):
    __tablename__ = "system_settings"

    # 例: key="tax"
    key = Column(String(64), primary_key=True)

    # 例: {"rate":0.10,"mode":"exclusive","rounding":"floor"}
    value = Column(JSON, nullable=False)

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=text("now()"),
    )
