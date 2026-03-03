from __future__ import annotations

from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user  # ★ users.py と揃える
from app.models.instruction_order import InstructionOrderORM
from app.models.car import Car
from app.models.user import User
from app.schemas.calendar import CalendarDayOut, CalendarEventOut, InstructionOrderOut

router = APIRouter(tags=["calendar"])


def _to_utc_dt(d: date, *, end_of_day: bool) -> datetime:
    # DBはTIMESTAMPTZ想定（UTCでクエリ）
    if end_of_day:
        return datetime.combine(d, time(23, 59, 59), tzinfo=timezone.utc)
    return datetime.combine(d, time(0, 0, 0), tzinfo=timezone.utc)


def _safe_date(dt: Optional[datetime]) -> Optional[date]:
    if dt is None:
        return None
    try:
        return dt.date()
    except Exception:
        return None


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
        # ★NULL安全：ここで落ちると 500 になるので弾く
        start_d = _safe_date(getattr(ins, "received_at", None))
        end_d = _safe_date(getattr(ins, "due_at", None))
        if start_d is None or end_d is None:
            # データ不整合はスキップ（500にしない）
            continue

        title = "指示書"
        if car is not None:
            title = f"{getattr(car, 'stock_no', '')} {getattr(car, 'make', '')} {getattr(car, 'model', '')}".strip() or "指示書"

        events.append(
            CalendarEventOut(
                id=ins.id,
                start=start_d,
                end=end_d,
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
        # ★NULL安全（念のため）
        if getattr(ins, "received_at", None) is None or getattr(ins, "due_at", None) is None:
            continue

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
