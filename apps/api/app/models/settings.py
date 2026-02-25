from __future__ import annotations

from sqlalchemy import Column, DateTime, JSON, String, text
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class SystemSettingORM(Base):
    __tablename__ = "system_settings"
    key = Column(String(64), primary_key=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
