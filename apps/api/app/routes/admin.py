from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user
from app.dependencies.permissions import require_roles
from app.models.license import LicenseORM
from app.models.store import StoreORM
from app.models.user import User
from app.schemas.license import LicenseCreate, LicenseCreateOut, LicenseOut, LicenseUpdate
from app.core.security import get_password_hash

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(attach_current_user), Depends(require_roles("superadmin"))],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _gen_password(length: int = 12) -> str:
    """読みやすいランダムパスワードを生成（英数字＋記号）。"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        # 大文字・小文字・数字・記号を各 1 文字以上含む
        if (
            any(c.isupper() for c in pw)
            and any(c.islower() for c in pw)
            and any(c.isdigit() for c in pw)
            and any(c in "!@#$%" for c in pw)
        ):
            return pw


def _license_to_out(lic: LicenseORM, store: StoreORM) -> LicenseOut:
    return LicenseOut(
        id=lic.id,
        store_id=lic.store_id,
        store_name=store.name,
        plan=lic.plan,  # type: ignore[arg-type]
        status=lic.status,  # type: ignore[arg-type]
        trial_ends_at=lic.trial_ends_at,
        current_period_start=lic.current_period_start,
        current_period_end=lic.current_period_end,
        notes=lic.notes,
        created_at=lic.created_at,
        updated_at=lic.updated_at,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/licenses", response_model=List[LicenseOut])
def list_licenses(db: Session = Depends(get_db)) -> List[LicenseOut]:
    rows = (
        db.execute(
            select(LicenseORM, StoreORM)
            .join(StoreORM, StoreORM.id == LicenseORM.store_id)
            .order_by(LicenseORM.created_at.desc())
        )
        .all()
    )
    return [_license_to_out(lic, store) for lic, store in rows]


@router.post("/licenses", response_model=LicenseCreateOut, status_code=status.HTTP_201_CREATED)
def create_license(body: LicenseCreate, db: Session = Depends(get_db)) -> LicenseCreateOut:
    # 1. 店舗作成
    new_store = StoreORM(
        id=uuid.uuid4(),
        name=body.store_name,
    )
    db.add(new_store)
    db.flush()  # store.id を確定

    # 2. 管理者ユーザー作成
    initial_pw = _gen_password()
    new_user = User(
        id=uuid.uuid4(),
        email=body.admin_email,
        name=body.admin_name,
        password_hash=get_password_hash(initial_pw),
        is_active=True,
        store_id=new_store.id,
        role="admin",
    )
    db.add(new_user)

    # 3. ライセンス作成
    now = datetime.now(timezone.utc)
    trial_ends = now + timedelta(days=body.trial_days)
    new_license = LicenseORM(
        id=uuid.uuid4(),
        store_id=new_store.id,
        plan=body.plan,
        status="trial",
        trial_ends_at=trial_ends,
        current_period_start=now,
        current_period_end=trial_ends,
        notes=body.notes,
    )
    db.add(new_license)
    db.commit()
    db.refresh(new_license)
    db.refresh(new_store)

    return LicenseCreateOut(
        license=_license_to_out(new_license, new_store),
        store_id=str(new_store.id),
        admin_email=body.admin_email,
        initial_password=initial_pw,
        message=f"店舗「{body.store_name}」のライセンスを発行しました。初期パスワードを安全な方法でお知らせください。",
    )


@router.put("/licenses/{license_id}", response_model=LicenseOut)
def update_license(
    license_id: str,
    body: LicenseUpdate,
    db: Session = Depends(get_db),
) -> LicenseOut:
    lic = db.get(LicenseORM, uuid.UUID(license_id))
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")

    if body.plan is not None:
        lic.plan = body.plan
    if body.status is not None:
        lic.status = body.status
    if body.trial_ends_at is not None:
        lic.trial_ends_at = body.trial_ends_at
    if body.current_period_end is not None:
        lic.current_period_end = body.current_period_end
    if body.notes is not None:
        lic.notes = body.notes
    lic.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(lic)

    store = db.get(StoreORM, lic.store_id)
    if not store:
        raise HTTPException(status_code=500, detail="Store not found")
    return _license_to_out(lic, store)


@router.delete("/licenses/{license_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_license(license_id: str, db: Session = Depends(get_db)) -> None:
    lic = db.get(LicenseORM, uuid.UUID(license_id))
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "suspended"
    lic.updated_at = datetime.now(timezone.utc)
    db.commit()
