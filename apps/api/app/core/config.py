# app/core/config.py
# - Reads env vars from ".env" if available (pydantic-settings), otherwise falls back to os.environ.
# - Keep this minimal so the backend can boot even if optional deps are missing.

from __future__ import annotations

import os
from dataclasses import dataclass


def _get_env(name: str, default: str | None = None) -> str | None:
    v = os.getenv(name)
    return v if v not in (None, "") else default


# Prefer pydantic-settings when available (recommended for FastAPI projects).
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore

    class Settings(BaseSettings):
        DATABASE_URL: str = _get_env("DATABASE_URL", "sqlite:///./app.db") or "sqlite:///./app.db"

        # pydantic v2 config
        model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    settings = Settings()

except Exception:
    @dataclass(frozen=True)
    class Settings:
        DATABASE_URL: str = _get_env("DATABASE_URL", "sqlite:///./app.db") or "sqlite:///./app.db"

    settings = Settings()
