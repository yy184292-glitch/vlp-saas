from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.loaner_car import LoanerCarORM, LoanerReservationORM
from app.routes.push_notification import send_push_to_store
from app.schemas.loaner_car import (
    LoanerCarCreate,
    LoanerCarOut,
    LoanerCarUpdate,
    LoanerReservationCreate,
    LoanerReservationOut,
    LoanerReservationUpdate,
)

router = APIRouter(tags=["loaner_cars"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_store_id(request: Request) -> UUID:
    user = getattr(request.state, "user", None)
    store_id = getattr(user, "store_id", None)
    if isinstance(store_id, UUID):
        return store_id
    if isinstance(store_id, str):
        try:
            return UUID(store_id)
        except Exception:
            pass
    raise HTTPException(status_code=400, detail="store_id required")


def _check_overlap(
    db: Session,
    loaner_car_id: UUID,
    start_date,
    end_date,
    exclude_id: Optional[UUID] = None,
) -> None:
    """同一代車で期間が重なる予約がある場合は 400 を返す。

    重複判定: 既存の [s, e] と新規の [start, end] が重なる条件
        既存.start_date <= 新規.end_date AND 既存.end_date >= 新規.start_date
    """
    stmt = select(LoanerReservationORM).where(
        and_(
            LoanerReservationORM.loaner_car_id == loaner_car_id,
            LoanerReservationORM.start_date <= end_date,
            LoanerReservationORM.end_date >= start_date,
        )
    )
    if exclude_id:
        stmt = stmt.where(LoanerReservationORM.id != exclude_id)

    conflict = db.execute(stmt).scalars().first()
    if conflict:
        raise HTTPException(
            status_code=400,
            detail=(
                f"代車の予約期間が重複しています。"
                f"（既存: {conflict.start_date} 〜 {conflict.end_date}"
                + (f"、顧客: {conflict.customer_name}" if conflict.customer_name else "")
                + "）"
            ),
        )


# ============================================================
# 代車マスタ CRUD
# ============================================================

@router.get("/loaner-cars", response_model=List[LoanerCarOut])
def list_loaner_cars(
    request: Request,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
) -> List[LoanerCarOut]:
    store_id = _get_store_id(request)
    stmt = select(LoanerCarORM).where(LoanerCarORM.store_id == store_id)
    if not include_inactive:
        stmt = stmt.where(LoanerCarORM.is_active.is_(True))
    stmt = stmt.order_by(LoanerCarORM.name.asc())
    return db.execute(stmt).scalars().all()


@router.post("/loaner-cars", response_model=LoanerCarOut)
def create_loaner_car(
    request: Request,
    body: LoanerCarCreate,
    db: Session = Depends(get_db),
) -> LoanerCarOut:
    store_id = _get_store_id(request)
    now = _utcnow()
    car = LoanerCarORM(
        id=uuid4(),
        store_id=store_id,
        name=body.name.strip(),
        plate_no=body.plate_no,
        color=body.color,
        note=body.note,
        created_at=now,
        updated_at=now,
    )
    db.add(car)
    db.commit()
    db.refresh(car)
    return car


@router.put("/loaner-cars/{car_id}", response_model=LoanerCarOut)
def update_loaner_car(
    request: Request,
    car_id: UUID,
    body: LoanerCarUpdate,
    db: Session = Depends(get_db),
) -> LoanerCarOut:
    store_id = _get_store_id(request)
    car = db.get(LoanerCarORM, car_id)
    if not car or car.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    if body.name is not None:
        car.name = body.name.strip()
    if body.plate_no is not None:
        car.plate_no = body.plate_no
    if body.color is not None:
        car.color = body.color
    if body.note is not None:
        car.note = body.note
    if body.is_active is not None:
        car.is_active = body.is_active

    car.updated_at = _utcnow()
    db.commit()
    db.refresh(car)
    return car


@router.delete("/loaner-cars/{car_id}")
def delete_loaner_car(
    request: Request,
    car_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    store_id = _get_store_id(request)
    car = db.get(LoanerCarORM, car_id)
    if not car or car.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(car)
    db.commit()
    return {"deleted": True}


# ============================================================
# 代車予約 CRUD
# ============================================================

@router.get("/loaner-cars/{car_id}/reservations", response_model=List[LoanerReservationOut])
def list_reservations(
    request: Request,
    car_id: UUID,
    db: Session = Depends(get_db),
) -> List[LoanerReservationOut]:
    store_id = _get_store_id(request)
    car = db.get(LoanerCarORM, car_id)
    if not car or car.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    stmt = (
        select(LoanerReservationORM)
        .where(LoanerReservationORM.loaner_car_id == car_id)
        .order_by(LoanerReservationORM.start_date.asc())
    )
    return db.execute(stmt).scalars().all()


@router.get("/loaner-reservations", response_model=List[LoanerReservationOut])
def list_all_reservations(
    request: Request,
    db: Session = Depends(get_db),
) -> List[LoanerReservationOut]:
    """店舗の全代車予約を返す（カレンダー表示用）"""
    store_id = _get_store_id(request)
    stmt = (
        select(LoanerReservationORM)
        .where(LoanerReservationORM.store_id == store_id)
        .order_by(LoanerReservationORM.start_date.asc())
    )
    return db.execute(stmt).scalars().all()


@router.post("/loaner-reservations", response_model=LoanerReservationOut)
def create_reservation(
    request: Request,
    body: LoanerReservationCreate,
    db: Session = Depends(get_db),
) -> LoanerReservationOut:
    store_id = _get_store_id(request)

    car = db.get(LoanerCarORM, body.loaner_car_id)
    if not car or car.store_id != store_id:
        raise HTTPException(status_code=404, detail="代車が見つかりません")

    # 重複チェック
    _check_overlap(db, body.loaner_car_id, body.start_date, body.end_date)

    now = _utcnow()
    reservation = LoanerReservationORM(
        id=uuid4(),
        store_id=store_id,
        loaner_car_id=body.loaner_car_id,
        customer_name=body.customer_name,
        start_date=body.start_date,
        end_date=body.end_date,
        note=body.note,
        created_at=now,
        updated_at=now,
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)

    # プッシュ通知: 返却期限が今日の場合に通知
    from datetime import date as date_cls
    today = date_cls.today()
    if reservation.end_date == today:
        try:
            send_push_to_store(db, str(store_id), {
                "title": "代車の返却期限",
                "body": f"{reservation.customer_name} 様の代車（{car.name}）は本日返却予定です。",
                "url": "/loaner",
                "tag": "loaner-return",
            })
        except Exception:
            pass

    return reservation


@router.put("/loaner-reservations/{reservation_id}", response_model=LoanerReservationOut)
def update_reservation(
    request: Request,
    reservation_id: UUID,
    body: LoanerReservationUpdate,
    db: Session = Depends(get_db),
) -> LoanerReservationOut:
    store_id = _get_store_id(request)
    res = db.get(LoanerReservationORM, reservation_id)
    if not res or res.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    new_start = body.start_date if body.start_date is not None else res.start_date
    new_end = body.end_date if body.end_date is not None else res.end_date

    # 重複チェック（自分自身を除外）
    _check_overlap(db, res.loaner_car_id, new_start, new_end, exclude_id=reservation_id)

    if body.customer_name is not None:
        res.customer_name = body.customer_name
    if body.start_date is not None:
        res.start_date = body.start_date
    if body.end_date is not None:
        res.end_date = body.end_date
    if body.note is not None:
        res.note = body.note

    res.updated_at = _utcnow()
    db.commit()
    db.refresh(res)
    return res


@router.delete("/loaner-reservations/{reservation_id}")
def delete_reservation(
    request: Request,
    reservation_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    store_id = _get_store_id(request)
    res = db.get(LoanerReservationORM, reservation_id)
    if not res or res.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(res)
    db.commit()
    return {"deleted": True}
