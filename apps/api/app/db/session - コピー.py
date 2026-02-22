# app/db/session.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# SQLite例（あなたのDB URLに合わせて変更可）
DATABASE_URL = "sqlite:///./app.db"

# PostgreSQLなら例：
# DATABASE_URL = "postgresql+psycopg://user:password@localhost/dbname"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    future=True,
)

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