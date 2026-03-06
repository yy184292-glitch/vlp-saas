from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user
from app.dependencies.permissions import require_roles
from app.models.partner import PartnerORM, generate_partner_code
from app.models.referral import ReferralORM
from app.models.store import StoreORM
from app.schemas.partner import PartnerCreate, PartnerOut, PartnerStats, PartnerUpdate
from app.schemas.referral import REFERRAL_DISCOUNT_PER_ACTIVE, RANK_THRESHOLDS

router = APIRouter(
    prefix="/admin/partners",
    tags=["partners"],
    dependencies=[Depends(attach_current_user), Depends(require_roles("superadmin"))],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _active_referral_count(db: Session, partner_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(ReferralORM).where(
            ReferralORM.partner_id == partner_id,
            ReferralORM.status == "active",
        )
    ).scalar_one()


def _to_out(partner: PartnerORM, store: StoreORM, referral_count: int = 0) -> PartnerOut:
    return PartnerOut(
        id=partner.id,
        store_id=partner.store_id,
        store_name=store.name,
        code=partner.code,
        name=partner.name,
        rank=partner.rank,  # type: ignore[arg-type]
        rank_updated_at=partner.rank_updated_at,
        loan_type=partner.loan_type,
        insurance_type=partner.insurance_type,
        warranty_type=partner.warranty_type,
        is_active=partner.is_active,
        referral_count=referral_count,
        created_at=partner.created_at,
        updated_at=partner.updated_at,
    )


def _auto_update_rank(partner: PartnerORM, active_count: int) -> bool:
    """active referral 数に基づいてランクを自動更新。変更あれば True を返す。"""
    new_rank = "silver"
    if active_count >= RANK_THRESHOLDS["platinum"]:
        new_rank = "platinum"
    elif active_count >= RANK_THRESHOLDS["gold"]:
        new_rank = "gold"

    if partner.rank != new_rank:
        partner.rank = new_rank
        partner.rank_updated_at = datetime.now(timezone.utc)
        return True
    return False


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("", response_model=List[PartnerOut])
def list_partners(db: Session = Depends(get_db)) -> List[PartnerOut]:
    rows = db.execute(
        select(PartnerORM, StoreORM)
        .join(StoreORM, StoreORM.id == PartnerORM.store_id)
        .order_by(PartnerORM.created_at.desc())
    ).all()
    result = []
    for partner, store in rows:
        count = _active_referral_count(db, partner.id)
        result.append(_to_out(partner, store, count))
    return result


@router.post("", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(body: PartnerCreate, db: Session = Depends(get_db)) -> PartnerOut:
    store = db.get(StoreORM, body.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # 既存パートナーチェック
    existing = db.execute(
        select(PartnerORM).where(PartnerORM.store_id == body.store_id)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="この店舗は既にパートナー登録されています")

    # ユニークコード生成
    for _ in range(10):
        code = generate_partner_code()
        exists = db.execute(select(PartnerORM).where(PartnerORM.code == code)).scalar_one_or_none()
        if not exists:
            break

    partner = PartnerORM(
        id=uuid.uuid4(),
        store_id=body.store_id,
        code=code,
        name=body.name,
        rank=body.rank,
        loan_type=body.loan_type,
        insurance_type=body.insurance_type,
        warranty_type=body.warranty_type,
        is_active=True,
    )
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return _to_out(partner, store, 0)


@router.get("/code/{code}", response_model=PartnerOut)
def get_partner_by_code(code: str, db: Session = Depends(get_db)) -> PartnerOut:
    """コードからパートナーを検索（登録時バリデーション用）。"""
    row = db.execute(
        select(PartnerORM, StoreORM)
        .join(StoreORM, StoreORM.id == PartnerORM.store_id)
        .where(PartnerORM.code == code.upper(), PartnerORM.is_active == True)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="パートナーコードが見つかりません")
    partner, store = row
    count = _active_referral_count(db, partner.id)
    return _to_out(partner, store, count)


@router.get("/{partner_id}", response_model=PartnerOut)
def get_partner(partner_id: str, db: Session = Depends(get_db)) -> PartnerOut:
    row = db.execute(
        select(PartnerORM, StoreORM)
        .join(StoreORM, StoreORM.id == PartnerORM.store_id)
        .where(PartnerORM.id == uuid.UUID(partner_id))
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Partner not found")
    partner, store = row
    count = _active_referral_count(db, partner.id)
    return _to_out(partner, store, count)


@router.put("/{partner_id}", response_model=PartnerOut)
def update_partner(
    partner_id: str, body: PartnerUpdate, db: Session = Depends(get_db)
) -> PartnerOut:
    partner = db.get(PartnerORM, uuid.UUID(partner_id))
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    if body.name is not None:
        partner.name = body.name
    if body.rank is not None:
        partner.rank = body.rank
        partner.rank_updated_at = datetime.now(timezone.utc)
    if body.loan_type is not None:
        partner.loan_type = body.loan_type
    if body.insurance_type is not None:
        partner.insurance_type = body.insurance_type
    if body.warranty_type is not None:
        partner.warranty_type = body.warranty_type
    if body.is_active is not None:
        partner.is_active = body.is_active
    partner.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(partner)
    store = db.get(StoreORM, partner.store_id)
    count = _active_referral_count(db, partner.id)
    return _to_out(partner, store, count)  # type: ignore[arg-type]


@router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner(partner_id: str, db: Session = Depends(get_db)) -> None:
    partner = db.get(PartnerORM, uuid.UUID(partner_id))
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    db.delete(partner)
    db.commit()


@router.get("/{partner_id}/stores", response_model=List[dict])
def list_partner_stores(partner_id: str, db: Session = Depends(get_db)) -> List[dict]:
    """パートナー経由で紹介された店舗一覧。"""
    rows = db.execute(
        select(ReferralORM, StoreORM)
        .join(StoreORM, StoreORM.id == ReferralORM.referred_store_id)
        .where(ReferralORM.partner_id == uuid.UUID(partner_id))
        .order_by(ReferralORM.created_at.desc())
    ).all()
    return [
        {
            "referral_id": str(ref.id),
            "store_id": str(store.id),
            "store_name": store.name,
            "status": ref.status,
            "activated_at": ref.activated_at.isoformat() if ref.activated_at else None,
            "created_at": ref.created_at.isoformat(),
        }
        for ref, store in rows
    ]


@router.get("/{partner_id}/stats", response_model=PartnerStats)
def get_partner_stats(partner_id: str, db: Session = Depends(get_db)) -> PartnerStats:
    pid = uuid.UUID(partner_id)
    partner = db.get(PartnerORM, pid)
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")

    referrals = db.execute(
        select(ReferralORM).where(ReferralORM.partner_id == pid)
    ).scalars().all()

    active = sum(1 for r in referrals if r.status == "active")
    pending = sum(1 for r in referrals if r.status == "pending")
    total_discount = active * REFERRAL_DISCOUNT_PER_ACTIVE * 12  # 年間概算

    # ランク自動更新チェック
    if _auto_update_rank(partner, active):
        partner.updated_at = datetime.now(timezone.utc)
        db.commit()

    return PartnerStats(
        partner_id=pid,
        active_referrals=active,
        pending_referrals=pending,
        total_discount_generated=total_discount,
        monthly_discount=active * REFERRAL_DISCOUNT_PER_ACTIVE,
    )
