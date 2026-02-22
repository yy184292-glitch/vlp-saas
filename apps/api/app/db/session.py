# app/db/session.py
from __future__ import annotations

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _engine():
    # pool_pre_ping: avoid stale connections (useful for Postgres)
    # future=True: SQLAlchemy 2.0 style
    return create_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )


engine = _engine()

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


# FastAPI Dependency
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
