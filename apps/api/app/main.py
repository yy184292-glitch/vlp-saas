from __future__ import annotations

import os
import logging
import traceback

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.limiter import limiter
from app.core.settings import settings
from app.db import engine
from app.models.base import Base

from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.cars import router as cars_router
from app.routes.shaken import router as shaken_router
from app.routes.valuation import router as valuation_router
from app.routes.billing import router as billing_router
from app.routes.stores import router as stores_router
from app.routes.customers import router as customers_router
from app.routes.inventory import router as inventory_router
from app.routes.work import router as work_router
from app.routes.reports import router as reports_router
from app.routes.invites import router as invites_router
from app.routes.calendar import router as calendar_router
from app.routes.export import router as export_router
from app.routes.work_masters import router as work_masters_router
from app.routes.work_reports import router as work_reports_router
from app.routes.import_csv import router as import_csv_router
from app.routes.sales import router as sales_router
from app.routes.admin import router as admin_router
from app.routes.loaner_cars import router as loaner_cars_router
from app.routes.sns import router as sns_router
from app.routes.attendance import router as attendance_router
from app.routes.license_invoice import router as license_invoice_router
from app.routes.license_invoice import store_router as store_invoice_router
from app.routes.partner import router as partner_router
from app.routes.referral import router as referral_router
from app.routes.stripe_webhook import router as stripe_webhook_router
from app.routes.stripe_payment import router as stripe_payment_router
from app.routes.integrations import router as integrations_router
from app.routes.push_notification import router as push_notification_router
from app.routes.line_webhook import router as line_webhook_router
from app.routes.line import router as line_router
from app.routes.tax_calc import router as tax_calc_router

logger = logging.getLogger(__name__)

# ============================================================
# Sentry（SENTRY_DSN 環境変数があれば有効化）
# ============================================================

_sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.2,
        environment=os.getenv("ENV", "production"),
    )
    logger.info("Sentry initialized.")

# ============================================================
# FastAPI app (必ず最初に作る)
# ============================================================

app = FastAPI(
    title="VLP SaaS API",
    version="1.0.0",
    redirect_slashes=False,
)

# rate limiter をアプリに登録
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============================================================
# Exception handlers（app の後に定義する）
# ============================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


# ============================================================
# DB table creation (DEV ONLY)
# ============================================================

RUN_CREATE_ALL = os.getenv("RUN_CREATE_ALL", "0") == "1"

if RUN_CREATE_ALL:
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("DB tables ensured via create_all (RUN_CREATE_ALL=1).")
    except Exception:
        logger.exception("Base.metadata.create_all failed; continuing startup.")


# ============================================================
# CORS
# ============================================================

origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://vlp-web.onrender.com",
}

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

# ============================================================
# Ensure cars.updated_at column exists (safe for prod)
# ============================================================
def ensure_updated_at_column():
    try:
        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE cars
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
                DEFAULT NOW()
            """))
            conn.commit()
            logger.info("Ensured cars.updated_at column exists.")
    except Exception:
        logger.exception("Failed to ensure updated_at column.")

ensure_updated_at_column()


# ============================================================
# Routes
# ============================================================

API_PREFIX = "/api/v1"


@app.api_route("/", methods=["GET", "HEAD"], status_code=status.HTTP_200_OK)
def root():
    return {
        "status": "ok",
        "service": "vlp-api",
        "version": "1.0.0",
    }


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
        return {
            "status": "error",
            "service": "vlp-api",
            "database": "disconnected",
        }


# ============================================================
# Routers
# ============================================================

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(cars_router, prefix=API_PREFIX)
app.include_router(shaken_router, prefix=API_PREFIX)
app.include_router(valuation_router, prefix=API_PREFIX)
app.include_router(billing_router, prefix=API_PREFIX)
app.include_router(stores_router, prefix=API_PREFIX)
app.include_router(customers_router, prefix=API_PREFIX)
app.include_router(inventory_router, prefix=API_PREFIX)
app.include_router(work_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(invites_router, prefix=API_PREFIX)
app.include_router(calendar_router, prefix=API_PREFIX)
app.include_router(export_router, prefix=API_PREFIX)
app.include_router(work_masters_router, prefix=API_PREFIX)
app.include_router(work_reports_router, prefix=API_PREFIX)
app.include_router(import_csv_router, prefix=API_PREFIX)
app.include_router(sales_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(loaner_cars_router, prefix=API_PREFIX)
app.include_router(sns_router, prefix=API_PREFIX)
app.include_router(attendance_router, prefix=API_PREFIX)
app.include_router(license_invoice_router, prefix=API_PREFIX)
app.include_router(store_invoice_router, prefix=API_PREFIX)
app.include_router(partner_router, prefix=API_PREFIX)
app.include_router(referral_router, prefix=API_PREFIX)
app.include_router(stripe_webhook_router, prefix=API_PREFIX)
app.include_router(stripe_payment_router, prefix=API_PREFIX)
app.include_router(integrations_router, prefix=API_PREFIX)
app.include_router(push_notification_router, prefix=API_PREFIX)
app.include_router(line_webhook_router, prefix=API_PREFIX)
app.include_router(line_router, prefix=API_PREFIX)
app.include_router(tax_calc_router, prefix=API_PREFIX)
