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

# DBテーブル作成（開発用）
Base.metadata.create_all(bind=engine)

# FastAPI作成
app = FastAPI(
    title="VLP SaaS API",
    version="1.0.0",
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.FRONTEND_URL if hasattr(settings, "FRONTEND_URL") else "",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"


# ========================================
# 完全版 Health Endpoint（本番対応）
# ========================================
@app.api_route("/health", methods=["GET", "HEAD"], status_code=status.HTTP_200_OK)
def health_check():
    """
    Health check endpoint for:
    - Render health check
    - uptime monitoring
    - load balancer
    - frontend connectivity check
    """

    try:
        # DB接続チェック
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        return {
            "status": "ok",
            "service": "vlp-api",
            "version": "1.0.0",
            "database": "connected",
        }

    except SQLAlchemyError:
        return {
            "status": "error",
            "service": "vlp-api",
            "database": "disconnected",
        }


# router登録
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(cars_router, prefix=API_PREFIX)
app.include_router(shaken_router, prefix=API_PREFIX)