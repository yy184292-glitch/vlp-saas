from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user, get_current_user
from app.dependencies.permissions import require_roles
from app.models.license import LicenseORM
from app.models.partner import PartnerORM
from app.models.referral import ReferralORM
from app.models.store import StoreORM
from app.schemas.license_invoice import PLAN_PRICES
from app.schemas.referral import MyDiscountOut, REFERRAL_DISCOUNT_PER_ACTIVE, ReferralOut

router = APIRouter(
    prefix="/referrals",
    tags=["referrals"],
    dependencies=[Depends(attach_current_user)],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _generate_referral_code() -> str:
    """VLP- + 8文字英数字大文字（例: VLP-A3B2C4D5）。"""
    alphabet = string.ascii_uppercase + string.digits
    return "VLP-" + "".join(secrets.choice(alphabet) for _ in range(8))


def _ensure_own_code(store: StoreORM, db: Session) -> str:
    """店舗の紹介コードがなければ生成して保存する。"""
    if store.own_referral_code:
        return store.own_referral_code

    for _ in range(10):
        code = _generate_referral_code()
        exists = db.execute(
            select(StoreORM).where(StoreORM.own_referral_code == code)
        ).scalar_one_or_none()
        if not exists:
            break

    store.own_referral_code = code
    db.commit()
    return code


def _to_out(ref: ReferralORM, referrer_name: str, referred_name: str) -> ReferralOut:
    return ReferralOut(
        id=ref.id,
        referrer_store_id=ref.referrer_store_id,
        referrer_store_name=referrer_name,
        referred_store_id=ref.referred_store_id,
        referred_store_name=referred_name,
        referral_code=ref.referral_code,
        partner_id=ref.partner_id,
        status=ref.status,
        activated_at=ref.activated_at,
        cancelled_at=ref.cancelled_at,
        created_at=ref.created_at,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[ReferralOut])
def list_referrals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[ReferralOut]:
    """admin: 全件 / store: 自分関連（referrer or referred）。"""
    Referrer = StoreORM.__table__.alias("referrer")
    Referred = StoreORM.__table__.alias("referred")

    if current_user.role in ("superadmin", "admin", "manager"):
        rows = db.execute(
            select(ReferralORM, StoreORM.name.label("referrer_name"))
            .join(StoreORM, StoreORM.id == ReferralORM.referrer_store_id)
            .order_by(ReferralORM.created_at.desc())
        ).all()

        result = []
        for ref, referrer_name in rows:
            referred_store = db.get(StoreORM, ref.referred_store_id)
            result.append(_to_out(ref, referrer_name, referred_store.name if referred_store else ""))
        return result

    # staff/store ユーザーは自分の店舗に関連するもののみ
    if not current_user.store_id:
        return []

    rows = db.execute(
        select(ReferralORM).where(
            (ReferralORM.referrer_store_id == current_user.store_id) |
            (ReferralORM.referred_store_id == current_user.store_id)
        ).order_by(ReferralORM.created_at.desc())
    ).scalars().all()

    result = []
    for ref in rows:
        referrer = db.get(StoreORM, ref.referrer_store_id)
        referred = db.get(StoreORM, ref.referred_store_id)
        result.append(_to_out(ref, referrer.name if referrer else "", referred.name if referred else ""))
    return result


@router.post(
    "/activate/{referral_id}",
    response_model=ReferralOut,
    dependencies=[Depends(require_roles("superadmin"))],
)
def activate_referral(referral_id: str, db: Session = Depends(get_db)) -> ReferralOut:
    """管理者が手動でreferralをactiveにする。"""
    ref = db.get(ReferralORM, uuid.UUID(referral_id))
    if not ref:
        raise HTTPException(status_code=404, detail="Referral not found")
    if ref.status == "active":
        raise HTTPException(status_code=400, detail="既にアクティブです")

    ref.status = "active"
    ref.activated_at = datetime.now(timezone.utc)
    db.commit()

    # 紹介元店舗のライセンス割引を再計算
    _recalc_referral_discount(db, ref.referrer_store_id)

    # パートナーランク自動更新
    if ref.partner_id:
        _update_partner_rank(db, ref.partner_id)

    referrer = db.get(StoreORM, ref.referrer_store_id)
    referred = db.get(StoreORM, ref.referred_store_id)
    return _to_out(ref, referrer.name if referrer else "", referred.name if referred else "")


@router.get("/my-code")
def get_my_code(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict:
    """自分の店舗の紹介コードを取得（なければ生成）。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")
    store = db.get(StoreORM, current_user.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    code = _ensure_own_code(store, db)
    return {"code": code, "store_name": store.name}


@router.get("/my-referrals", response_model=List[ReferralOut])
def my_referrals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[ReferralOut]:
    """自分が紹介した店舗一覧。"""
    if not current_user.store_id:
        return []

    rows = db.execute(
        select(ReferralORM)
        .where(ReferralORM.referrer_store_id == current_user.store_id)
        .order_by(ReferralORM.created_at.desc())
    ).scalars().all()

    result = []
    referrer = db.get(StoreORM, current_user.store_id)
    for ref in rows:
        referred = db.get(StoreORM, ref.referred_store_id)
        result.append(_to_out(ref, referrer.name if referrer else "", referred.name if referred else ""))
    return result


@router.get("/my-discount", response_model=MyDiscountOut)
def my_discount(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> MyDiscountOut:
    """現在の紹介割引額を返す。"""
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")

    active_count = db.execute(
        select(func.count()).select_from(ReferralORM).where(
            ReferralORM.referrer_store_id == current_user.store_id,
            ReferralORM.status == "active",
        )
    ).scalar_one()

    # 現在のプラン料金を取得
    lic = db.execute(
        select(LicenseORM).where(LicenseORM.store_id == current_user.store_id)
    ).scalar_one_or_none()
    plan = lic.plan if lic else "starter"
    billing_cycle = lic.billing_cycle if lic else "monthly"
    monthly_price = PLAN_PRICES.get(plan, {}).get("monthly", 9_800)

    monthly_discount = active_count * REFERRAL_DISCOUNT_PER_ACTIVE
    price_after = max(0, monthly_price - monthly_discount)
    slots_needed = max(0, monthly_price // REFERRAL_DISCOUNT_PER_ACTIVE - active_count)

    return MyDiscountOut(
        active_referrals=active_count,
        monthly_discount=monthly_discount,
        monthly_price_before=monthly_price,
        monthly_price_after=price_after,
        free_slots_needed=slots_needed,
    )


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _recalc_referral_discount(db: Session, store_id: uuid.UUID) -> None:
    """紹介元店舗のライセンス割引額を再計算して保存。"""
    active_count = db.execute(
        select(func.count()).select_from(ReferralORM).where(
            ReferralORM.referrer_store_id == store_id,
            ReferralORM.status == "active",
        )
    ).scalar_one()

    lic = db.execute(
        select(LicenseORM).where(LicenseORM.store_id == store_id)
    ).scalar_one_or_none()
    if lic:
        lic.referral_discount = active_count * REFERRAL_DISCOUNT_PER_ACTIVE
        db.commit()


def _update_partner_rank(db: Session, partner_id: uuid.UUID) -> None:
    """パートナーのランクをactive referral数に基づいて自動更新。"""
    from app.routes.partner import _auto_update_rank, _active_referral_count
    partner = db.get(PartnerORM, partner_id)
    if not partner:
        return
    active = _active_referral_count(db, partner_id)
    if _auto_update_rank(partner, active):
        partner.updated_at = datetime.now(timezone.utc)
        db.commit()
