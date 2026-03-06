from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.license import LicenseORM
from app.models.referral import ReferralORM
from app.schemas.referral import REFERRAL_DISCOUNT_PER_ACTIVE

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stripe", tags=["stripe"])

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


def _get_stripe():
    """Stripe モジュールを動的ロード（未インストール時は None）。"""
    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        return stripe
    except ImportError:
        logger.warning("stripe パッケージが未インストールです。モック動作します。")
        return None


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(request: Request) -> dict:
    """Stripe の webhook を受信して処理する。"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    stripe = _get_stripe()

    if stripe and STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            logger.error(f"Stripe webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # Stripe 未設定時はペイロードをそのまま JSON デコード（テスト用）
        import json
        try:
            event = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    # DB セッションを取得
    db_gen = get_db()
    db: Session = next(db_gen)
    try:
        if event_type == "customer.subscription.created":
            _handle_subscription_created(db, data)
        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(db, data)
        elif event_type == "invoice.payment_succeeded":
            _handle_payment_succeeded(db, data)
        elif event_type == "invoice.payment_failed":
            _handle_payment_failed(db, data)
        else:
            logger.info(f"Unhandled Stripe event: {event_type}")
    finally:
        db.close()

    return {"received": True}


# ─── Event handlers ───────────────────────────────────────────────────────────

def _handle_subscription_created(db: Session, obj: dict) -> None:
    """customer.subscription.created → license.status = active"""
    customer_id = obj.get("customer", "")
    subscription_id = obj.get("id", "")
    lic = db.execute(
        select(LicenseORM).where(LicenseORM.stripe_customer_id == customer_id)
    ).scalar_one_or_none()
    if not lic:
        logger.warning(f"No license found for Stripe customer: {customer_id}")
        return

    lic.status = "active"
    lic.stripe_subscription_id = subscription_id
    now = datetime.now(timezone.utc)
    lic.current_period_start = now
    lic.current_period_end = now + timedelta(days=30)
    lic.updated_at = now
    db.commit()
    logger.info(f"License activated for customer {customer_id}")


def _handle_subscription_deleted(db: Session, obj: dict) -> None:
    """customer.subscription.deleted → license.status = expired"""
    subscription_id = obj.get("id", "")
    lic = db.execute(
        select(LicenseORM).where(LicenseORM.stripe_subscription_id == subscription_id)
    ).scalar_one_or_none()
    if not lic:
        return

    lic.status = "expired"
    lic.updated_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"License expired for subscription {subscription_id}")


def _handle_payment_succeeded(db: Session, obj: dict) -> None:
    """invoice.payment_succeeded → 3ヶ月チェック → referral を pending → active に"""
    customer_id = obj.get("customer", "")
    if not customer_id:
        return

    lic = db.execute(
        select(LicenseORM).where(LicenseORM.stripe_customer_id == customer_id)
    ).scalar_one_or_none()
    if not lic:
        return

    # current_period を更新
    now = datetime.now(timezone.utc)
    lic.current_period_start = now
    lic.current_period_end = now + timedelta(days=30)
    lic.updated_at = now

    # 3ヶ月継続チェック（登録から90日以上経過した pending referral を active に）
    pending_referrals = db.execute(
        select(ReferralORM).where(
            ReferralORM.referred_store_id == lic.store_id,
            ReferralORM.status == "pending",
        )
    ).scalars().all()

    for ref in pending_referrals:
        days_since_created = (now - ref.created_at.replace(tzinfo=timezone.utc)).days
        if days_since_created >= 90:
            ref.status = "active"
            ref.activated_at = now
            logger.info(f"Referral {ref.id} auto-activated after 90 days")

            # 紹介元のライセンス割引を更新
            referrer_lic = db.execute(
                select(LicenseORM).where(LicenseORM.store_id == ref.referrer_store_id)
            ).scalar_one_or_none()
            if referrer_lic:
                referrer_lic.referral_discount = (
                    referrer_lic.referral_discount + REFERRAL_DISCOUNT_PER_ACTIVE
                )

    db.commit()


def _handle_payment_failed(db: Session, obj: dict) -> None:
    """invoice.payment_failed → ログ記録のみ（通知はSentryで対応）。"""
    customer_id = obj.get("customer", "")
    invoice_id = obj.get("id", "")
    logger.warning(f"Payment failed: customer={customer_id}, invoice={invoice_id}")
