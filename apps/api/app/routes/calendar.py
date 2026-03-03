from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, cast, select
from sqlalchemy.orm import Session
from sqlalchemy.types import Date as SA_Date

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.instruction_order import InstructionOrderORM
from app.models.car import Car
from app.models.user import User
from app.schemas.calendar import CalendarDayOut, CalendarEventOut, InstructionOrderOut

router = APIRouter(tags=["calendar"])


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

    # ★ DB側の型ズレ（DATE / TIMESTAMP / TIMESTAMPTZ）に強くするため、
    #   比較を "date" ベースに寄せる
    received_date = cast(InstructionOrderORM.received_at, SA_Date)
    due_date = cast(InstructionOrderORM.due_at, SA_Date)

    stmt = (
        select(InstructionOrderORM, Car)
        .outerjoin(Car, Car.id == InstructionOrderORM.car_id)
        .where(
            InstructionOrderORM.store_id == user.store_id,
            and_(
                received_date <= date_to,
                due_date >= date_from,
            ),
        )
        .order_by(InstructionOrderORM.due_at.asc())
    )

    rows = db.execute(stmt).all()
    events: list[CalendarEventOut] = []

    for ins, car in rows:
        # received_at/due_at は ORM 上 nullable=False だが、万一のデータ不整合でも落とさない
        if getattr(ins, "received_at", None) is None or getattr(ins, "due_at", None) is None:
            continue

        title = "指示書"
        if car is not None:
            title = f"{getattr(car, 'stock_no', '')} {getattr(car, 'make', '')} {getattr(car, 'model', '')}".strip() or "指示書"

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

    received_date = cast(InstructionOrderORM.received_at, SA_Date)
    due_date = cast(InstructionOrderORM.due_at, SA_Date)

    stmt = (
        select(InstructionOrderORM, Car)
        .outerjoin(Car, Car.id == InstructionOrderORM.car_id)
        .where(
            InstructionOrderORM.store_id == user.store_id,
            received_date <= target,
            due_date >= target,
        )
        .order_by(InstructionOrderORM.due_at.asc())
    )

    rows = db.execute(stmt).all()
    items: list[InstructionOrderOut] = []

    for ins, car in rows:
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
