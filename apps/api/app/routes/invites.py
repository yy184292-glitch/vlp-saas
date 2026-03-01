from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user
from app.dependencies.permissions import require_roles
from app.models.invite import StoreInviteORM, generate_invite_code
from app.models.store import StoreORM
from app.models.user import User


router = APIRouter(tags=["invites"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InviteCreateIn(BaseModel):
    role: str = Field(default="staff", description="admin/manager/staff")
    max_uses: int = Field(default=1, ge=1, le=50)
    expires_at: Optional[datetime] = None
    code_length: int = Field(default=10, ge=6, le=24)


class InviteOut(BaseModel):
    id: UUID
    store_id: UUID
    code: str
    role: str
    max_uses: int
    used_count: int
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class SeatsOut(BaseModel):
    store_id: UUID
    plan_code: str
    seat_limit: int
    active_users: int


def _get_store_id(user: User) -> UUID:
    sid = getattr(user, "store_id", None)
    if isinstance(sid, UUID):
        return sid
    raise HTTPException(status_code=400, detail="store_id required")


@router.get(
    "/invites/seats",
    response_model=SeatsOut,
)
def get_seats(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(attach_current_user),
):
    """現在の席数（ユーザー数）状況"""
    sid = _get_store_id(user)

    store = db.get(StoreORM, sid)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    active_users = db.execute(
        select(func.count()).select_from(User).where(User.store_id == sid, User.is_active == True)  # noqa: E712
    ).scalar_one()

    return SeatsOut(
        store_id=sid,
        plan_code=getattr(store, "plan_code", "basic") or "basic",
        seat_limit=int(getattr(store, "seat_limit", 5) or 5),
        active_users=int(active_users or 0),
    )


@router.get(
    "/invites",
    response_model=List[InviteOut],
)
def list_invites(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(attach_current_user),
    _: User = Depends(require_roles("admin", "manager")),
):
    sid = _get_store_id(user)
    stmt = (
        select(StoreInviteORM)
        .where(StoreInviteORM.store_id == sid)
        .order_by(StoreInviteORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return db.execute(stmt).scalars().all()


@router.post(
    "/invites",
    response_model=InviteOut,
)
def create_invite(
    request: Request,
    body: InviteCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(attach_current_user),
    _: User = Depends(require_roles("admin", "manager")),
):
    sid = _get_store_id(user)

    # store exists
    store = db.get(StoreORM, sid)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    role = body.role.strip().lower()
    if role not in ("admin", "manager", "staff"):
        raise HTTPException(status_code=422, detail="role must be admin/manager/staff")

    # generate unique code (few retries)
    code = None
    for _i in range(6):
        cand = generate_invite_code(body.code_length)
        exists = db.execute(select(StoreInviteORM).where(StoreInviteORM.code == cand)).scalar_one_or_none()
        if not exists:
            code = cand
            break
    if not code:
        raise HTTPException(status_code=500, detail="Failed to generate invite code")

    now = _utcnow()
    inv = StoreInviteORM(
        id=uuid4(),
        store_id=sid,
        code=code,
        role=role,
        max_uses=body.max_uses,
        used_count=0,
        created_by_user_id=getattr(user, "id", None),
        expires_at=body.expires_at,
        created_at=now,
        updated_at=now,
    )

    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv
