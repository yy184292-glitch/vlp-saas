"""勤怠管理 API ルート

GET  /attendance              一覧（管理者=全スタッフ、スタッフ=自分のみ）
POST /attendance/clock-in     出勤打刻
POST /attendance/clock-out    退勤打刻
GET  /attendance/today        今日の打刻状況（ログインユーザー）
PUT  /attendance/{id}         管理者による修正
DELETE /attendance/{id}       管理者による削除
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.attendance import AttendanceORM
from app.models.user import User
from app.schemas.attendance import (
    AttendanceListOut,
    AttendanceOut,
    AttendanceUpdate,
    ClockInRequest,
    ClockOutRequest,
)

router = APIRouter(tags=["attendance"])

# JST = UTC+9
JST = timezone(timedelta(hours=9))

ADMIN_ROLES = {"admin", "manager", "superadmin"}


def _today_jst() -> date:
    return datetime.now(JST).date()


def _get_store_id(user: User) -> UUID:
    sid = getattr(user, "store_id", None)
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    return sid


def _is_admin(user: User) -> bool:
    return getattr(user, "role", "staff") in ADMIN_ROLES


def _enrich(row: AttendanceORM, db: Session) -> AttendanceOut:
    """ユーザー名を付加して AttendanceOut を返す"""
    out = AttendanceOut.model_validate(row)
    u = db.get(User, row.user_id)
    if u:
        out.user_name = u.name or u.email
        out.user_email = u.email
    return out


# ─── 一覧 ────────────────────────────────────────────────────

@router.get("/attendance", response_model=AttendanceListOut)
def list_attendance(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    user_id: Optional[UUID] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AttendanceListOut:
    sid = _get_store_id(user)
    cond = [AttendanceORM.store_id == sid]

    # スタッフは自分のみ
    if not _is_admin(user):
        cond.append(AttendanceORM.user_id == user.id)
    elif user_id:
        cond.append(AttendanceORM.user_id == user_id)

    if start_date:
        cond.append(AttendanceORM.work_date >= start_date)
    if end_date:
        cond.append(AttendanceORM.work_date <= end_date)

    total = db.execute(
        select(func.count()).select_from(AttendanceORM).where(and_(*cond))
    ).scalar_one()

    rows = db.execute(
        select(AttendanceORM)
        .where(and_(*cond))
        .order_by(AttendanceORM.work_date.desc(), AttendanceORM.clock_in.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return AttendanceListOut(
        items=[_enrich(r, db) for r in rows],
        total=int(total),
    )


# ─── 今日の打刻状況 ──────────────────────────────────────────

@router.get("/attendance/today", response_model=Optional[AttendanceOut])
def get_today(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Optional[AttendanceOut]:
    sid = _get_store_id(user)
    today = _today_jst()
    row = db.execute(
        select(AttendanceORM).where(
            and_(
                AttendanceORM.store_id == sid,
                AttendanceORM.user_id == user.id,
                AttendanceORM.work_date == today,
            )
        )
    ).scalar_one_or_none()
    if not row:
        return None
    return _enrich(row, db)


# ─── 出勤打刻 ────────────────────────────────────────────────

@router.post("/attendance/clock-in", response_model=AttendanceOut)
def clock_in(
    body: ClockInRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AttendanceOut:
    sid = _get_store_id(user)
    today = _today_jst()
    now = datetime.now(timezone.utc)

    # 当日レコード確認
    existing = db.execute(
        select(AttendanceORM).where(
            and_(
                AttendanceORM.store_id == sid,
                AttendanceORM.user_id == user.id,
                AttendanceORM.work_date == today,
            )
        )
    ).scalar_one_or_none()

    if existing and existing.clock_in is not None:
        raise HTTPException(status_code=400, detail="すでに出勤打刻済みです")

    if existing:
        existing.clock_in = now
        existing.clock_in_lat = body.lat
        existing.clock_in_lng = body.lng
        existing.clock_in_address = body.address
        if body.note:
            existing.note = body.note
        existing.updated_at = now
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return _enrich(existing, db)

    row = AttendanceORM(
        id=uuid.uuid4(),
        store_id=sid,
        user_id=user.id,
        work_date=today,
        clock_in=now,
        clock_in_lat=body.lat,
        clock_in_lng=body.lng,
        clock_in_address=body.address,
        note=body.note,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="すでに出勤打刻済みです")
    db.refresh(row)
    return _enrich(row, db)


# ─── 退勤打刻 ────────────────────────────────────────────────

@router.post("/attendance/clock-out", response_model=AttendanceOut)
def clock_out(
    body: ClockOutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AttendanceOut:
    sid = _get_store_id(user)
    today = _today_jst()
    now = datetime.now(timezone.utc)

    row = db.execute(
        select(AttendanceORM).where(
            and_(
                AttendanceORM.store_id == sid,
                AttendanceORM.user_id == user.id,
                AttendanceORM.work_date == today,
            )
        )
    ).scalar_one_or_none()

    if not row or row.clock_in is None:
        raise HTTPException(status_code=400, detail="出勤打刻がありません")
    if row.clock_out is not None:
        raise HTTPException(status_code=400, detail="すでに退勤打刻済みです")

    row.clock_out = now
    row.clock_out_lat = body.lat
    row.clock_out_lng = body.lng
    row.clock_out_address = body.address
    if body.note:
        row.note = (row.note or "") + (" " + body.note).strip()
    row.updated_at = now
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich(row, db)


# ─── 管理者修正 ──────────────────────────────────────────────

@router.put("/attendance/{attendance_id}", response_model=AttendanceOut)
def update_attendance(
    attendance_id: UUID,
    body: AttendanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AttendanceOut:
    sid = _get_store_id(user)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="管理者のみ修正可能です")

    row = db.get(AttendanceORM, attendance_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _enrich(row, db)


@router.delete("/attendance/{attendance_id}")
def delete_attendance(
    attendance_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sid = _get_store_id(user)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="管理者のみ削除可能です")

    row = db.get(AttendanceORM, attendance_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")

    db.delete(row)
    db.commit()
    return {"ok": True}
