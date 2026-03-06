from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user, get_current_user
from app.models.license import LicenseORM
from app.models.store import StoreORM
from app.schemas.license_invoice import PLAN_PRICES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stripe",
    tags=["stripe"],
    dependencies=[Depends(attach_current_user)],
)

# Stripe Price ID マッピング（環境変数から取得）
STRIPE_PRICES: dict[str, dict[str, str]] = {
    "starter":  {
        "monthly": os.getenv("STRIPE_PRICE_STARTER_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_STARTER_YEARLY", ""),
    },
    "standard": {
        "monthly": os.getenv("STRIPE_PRICE_STANDARD_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_STANDARD_YEARLY", ""),
    },
    "pro": {
        "monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_PRO_YEARLY", ""),
    },
}

FRONTEND_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")


def _get_stripe():
    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
        return stripe
    except ImportError:
        return None


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CheckoutSessionRequest(BaseModel):
    plan: str = "starter"
    billing_cycle: str = "monthly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class PortalSessionRequest(BaseModel):
    return_url: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/create-checkout-session")
def create_checkout_session(
    body: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Stripe チェックアウトセッションを作成してリダイレクトURLを返す。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    lic = db.execute(
        select(LicenseORM).where(LicenseORM.store_id == current_user.store_id)
    ).scalar_one_or_none()
    if not lic:
        raise HTTPException(status_code=404, detail="ライセンスが見つかりません")

    stripe = _get_stripe()
    if not stripe or not os.getenv("STRIPE_SECRET_KEY"):
        # モック動作（Stripe 未設定）
        return {
            "url": f"{FRONTEND_URL}/settings/billing?mock=checkout",
            "session_id": "mock_session",
            "mock": True,
        }

    price_id = STRIPE_PRICES.get(body.plan, {}).get(body.billing_cycle, "")
    if not price_id:
        raise HTTPException(status_code=400, detail=f"プライスID未設定: {body.plan}/{body.billing_cycle}")

    store = db.get(StoreORM, current_user.store_id)

    # Stripe Customer 作成または取得
    if lic.stripe_customer_id:
        customer_id = lic.stripe_customer_id
    else:
        customer = stripe.Customer.create(
            name=store.name if store else "",
            email=current_user.email,
            metadata={"store_id": str(current_user.store_id), "license_id": str(lic.id)},
        )
        customer_id = customer.id
        lic.stripe_customer_id = customer_id
        db.commit()

    # 紹介割引クーポンの動的生成
    coupon_id = None
    if lic.referral_discount and lic.referral_discount > 0:
        try:
            coupon = stripe.Coupon.create(
                amount_off=lic.referral_discount,
                currency="jpy",
                duration="repeating",
                duration_in_months=12,
                name=f"紹介割引 -¥{lic.referral_discount:,}/月",
            )
            coupon_id = coupon.id
        except Exception as e:
            logger.warning(f"Failed to create coupon: {e}")

    session_params: dict = {
        "customer": customer_id,
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "subscription",
        "success_url": body.success_url or f"{FRONTEND_URL}/settings/billing?success=1",
        "cancel_url": body.cancel_url or f"{FRONTEND_URL}/settings/billing?cancelled=1",
        "metadata": {"store_id": str(current_user.store_id), "license_id": str(lic.id)},
    }
    if coupon_id:
        session_params["discounts"] = [{"coupon": coupon_id}]

    session = stripe.checkout.Session.create(**session_params)
    return {"url": session.url, "session_id": session.id}


@router.post("/create-portal-session")
def create_portal_session(
    body: PortalSessionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """Stripe 顧客ポータルセッション（支払方法変更・領収書確認）。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    lic = db.execute(
        select(LicenseORM).where(LicenseORM.store_id == current_user.store_id)
    ).scalar_one_or_none()

    stripe = _get_stripe()
    if not stripe or not os.getenv("STRIPE_SECRET_KEY"):
        return {
            "url": f"{FRONTEND_URL}/settings/billing?mock=portal",
            "mock": True,
        }

    if not lic or not lic.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Stripe 顧客IDが登録されていません。先に決済設定をしてください。")

    session = stripe.billing_portal.Session.create(
        customer=lic.stripe_customer_id,
        return_url=body.return_url or f"{FRONTEND_URL}/settings/billing",
    )
    return {"url": session.url}


@router.get("/subscription-status")
def subscription_status(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """現在のサブスクリプション状態を返す。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    lic = db.execute(
        select(LicenseORM).where(LicenseORM.store_id == current_user.store_id)
    ).scalar_one_or_none()
    if not lic:
        raise HTTPException(status_code=404, detail="ライセンスが見つかりません")

    plan = lic.plan
    prices = PLAN_PRICES.get(plan, {})

    return {
        "plan": plan,
        "billing_cycle": lic.billing_cycle,
        "status": lic.status,
        "stripe_customer_id": lic.stripe_customer_id,
        "stripe_subscription_id": lic.stripe_subscription_id,
        "has_stripe": bool(lic.stripe_customer_id),
        "referral_discount": lic.referral_discount,
        "monthly_price": prices.get("monthly", 0),
        "yearly_price": prices.get("yearly", 0),
        "current_period_end": lic.current_period_end.isoformat() if lic.current_period_end else None,
    }
