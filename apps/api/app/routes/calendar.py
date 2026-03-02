from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.instruction_order import InstructionOrderORM
from app.models.car import Car
from app.models.store_setting import StoreSettingORM
from app.models.user import User
from app.schemas.calendar import CalendarDayOut, CalendarEventOut, InstructionOrderOut

router = APIRouter(tags=["calendar"])


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _to_utc_dt(d: date, *, end_of_day: bool) -> datetime:
    # DBはTIMESTAMPTZ想定（UTCでクエリ）
    if end_of_day:
        return datetime.combine(d, time(23, 59, 59), tzinfo=timezone.utc)
    return datetime.combine(d, time(0, 0, 0), tzinfo=timezone.utc)


def _get_or_create_store_setting(db: Session, store_id: UUID) -> StoreSettingORM:
    row = db.get(StoreSettingORM, store_id)
    if row:
        return row
    row = StoreSettingORM(store_id=store_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/calendar/events", response_model=list[CalendarEventOut])
def list_calendar_events(
    date_from: date = Query(..., alias="from"),
    date_to: date = Query(..., alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CalendarEventOut]:
    """カレンダー表示用イベント

    - 指示書（instruction_orders）の received_at〜due_at を帯で表示
    - 期間は [from, to] の日付範囲
    """

    if date_to < date_from:
        raise HTTPException(status_code=400, detail="Invalid range")

    start_dt = _to_utc_dt(date_from, end_of_day=False)
    end_dt = _to_utc_dt(date_to, end_of_day=True)

    # 期間内に1日でも重なるものを取得
    stmt = (
        select(InstructionOrderORM, Car)
        .outerjoin(Car, Car.id == InstructionOrderORM.car_id)
        .where(
            InstructionOrderORM.store_id == user.store_id,
            and_(
                InstructionOrderORM.received_at <= end_dt,
                InstructionOrderORM.due_at >= start_dt,
            ),
        )
        .order_by(InstructionOrderORM.due_at.asc())
    )

    rows = db.execute(stmt).all()
    events: list[CalendarEventOut] = []

    for ins, car in rows:
        title = "指示書"
        if car is not None:
            # 既存カラムに合わせて最小情報
            title = f"{getattr(car, 'stock_no', '')} {getattr(car, 'make', '')} {getattr(car, 'model', '')}".strip()

        # UI側は end を inclusive で扱いやすいので date を返す
        events.append(
            CalendarEventOut(
                id=ins.id,
                start=ins.received_at.date(),
                end=ins.due_at.date(),
                due_at=ins.due_at,
                status=ins.status,
                title=title,
                memo=ins.memo,
            )
        )

    return events


@router.get("/calendar/day", response_model=CalendarDayOut)
def get_calendar_day(
    target: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CalendarDayOut:
    """指定日の表示データ

    - その日に「帯がかかる」指示書（received_at <= date <= due_at）を返す
    """

    start_dt = _to_utc_dt(target, end_of_day=False)
    end_dt = _to_utc_dt(target, end_of_day=True)

    stmt = (
        select(InstructionOrderORM, Car)
        .outerjoin(Car, Car.id == InstructionOrderORM.car_id)
        .where(
            InstructionOrderORM.store_id == user.store_id,
            InstructionOrderORM.received_at <= end_dt,
            InstructionOrderORM.due_at >= start_dt,
        )
        .order_by(InstructionOrderORM.due_at.asc())
    )

    rows = db.execute(stmt).all()
    items: list[InstructionOrderOut] = []
    for ins, car in rows:
        car_stock_no = getattr(car, "stock_no", None) if car is not None else None
        car_title = None
        if car is not None:
            car_title = f"{getattr(car, 'make', '')} {getattr(car, 'model', '')}".strip() or None

        items.append(
            InstructionOrderOut(
                id=ins.id,
                store_id=ins.store_id,
                car_id=ins.car_id,
                received_at=ins.received_at,
                due_at=ins.due_at,
                status=ins.status,
                memo=ins.memo,
                car_stock_no=car_stock_no,
                car_title=car_title,
            )
        )

    return CalendarDayOut(date=target, items=items)
