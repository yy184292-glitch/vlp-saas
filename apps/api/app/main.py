from __future__ import annotations

import os
import logging

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.settings import settings
from app.db import engine
from app.models.base import Base

from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.cars import router as cars_router
from app.routes.shaken import router as shaken_router

logger = logging.getLogger(__name__)

# ============================================================
# DB table creation (DEV ONLY)
# ============================================================
RUN_CREATE_ALL = os.getenv("RUN_CREATE_ALL", "0") == "1"
if RUN_CREATE_ALL:
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("DB tables ensured via create_all (RUN_CREATE_ALL=1).")
    except Exception:
        logger.exception("Base.metadata.create_all failed; continuing startup without it.")

app = FastAPI(
    title="VLP SaaS API",
    version="1.0.0",
)

# ============================================================
# CORS
# Explicitly allow Render Web origin to stop browser CORS blocks.
# ============================================================
origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://vlp-web.onrender.com",
}

# Optional: allow custom frontend URL from env/settings
frontend_url = getattr(settings, "FRONTEND_URL", None)
if isinstance(frontend_url, str) and frontend_url.strip():
    origins.add(frontend_url.strip().rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"


@app.api_route("/", methods=["GET", "HEAD"], status_code=status.HTTP_200_OK)
def root():
    return {"status": "ok", "service": "vlp-api", "version": "1.0.0"}


@app.api_route("/health", methods=["GET", "HEAD"], status_code=status.HTTP_200_OK)
def health_check():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "service": "vlp-api",
            "version": "1.0.0",
            "database": "connected",
        }
    except SQLAlchemyError:
        return {"status": "error", "service": "vlp-api", "database": "disconnected"}


app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(cars_router, prefix=API_PREFIX)
app.include_router(shaken_router, prefix=API_PREFIX)
