from __future__ import annotations

import calendar
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user
from app.dependencies.permissions import require_roles
from app.models.car import Car
from app.models.user import User

router = APIRouter(
    tags=["sales"],
    dependencies=[Depends(attach_current_user), Depends(require_roles("admin", "manager"))],
)

# 在庫・商談中以外のステータスを「売却済み」と見なす
UNSOLD_STATUSES = ("在庫", "商談中")


# ============================================================
# Helpers
# ============================================================

def _store_id(request: Request) -> UUID:
    user = getattr(request.state, "user", None)
    sid = getattr(user, "store_id", None)
    if isinstance(sid, str):
        try:
            sid = UUID(sid)
        except Exception:
            sid = None
    if not isinstance(sid, UUID):
        raise HTTPException(status_code=400, detail="store_id required")
    return sid


def _month_window(year: int, month: int) -> tuple[datetime, datetime]:
    """UTC での月初～月末 datetime を返す。"""
    last_day = calendar.monthrange(year, month)[1]
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


# ============================================================
# Schemas
# ============================================================

class MonthKpi(BaseModel):
    count: int
    sales: int
    profit: int
    profit_rate: float


class SalesSummaryOut(BaseModel):
    year: int
    month: int
    this_month: MonthKpi
    prev_month: MonthKpi
    inventory_count: int
    negotiating_count: int


class SalesMonthlyRow(BaseModel):
    year: int
    month: int
    count: int
    sales: int
    profit: int
    profit_rate: float


class SalesMonthlyOut(BaseModel):
    year: int
    rows: list[SalesMonthlyRow]


class SalesByCarRow(BaseModel):
    car_id: str
    stock_no: str
    make: str
    model: str
    status: str
    buy_price: int | None
    sell_price: int | None
    profit: int | None
    profit_rate: float | None
    staff_name: str | None
    sold_at: str


class SalesByCarOut(BaseModel):
    year: int
    month: int
    rows: list[SalesByCarRow]


class SalesByStaffRow(BaseModel):
    user_id: str
    staff_name: str
    count: int
    total_sales: int
    total_profit: int
    avg_profit_rate: float


class SalesByStaffOut(BaseModel):
    year: int
    month: int
    rows: list[SalesByStaffRow]


class InventoryStatsOut(BaseModel):
    total_count: int
    total_cost: int
    negotiating_count: int


# ============================================================
# Internal KPI aggregation
# ============================================================

def _kpi_for_window(
    db: Session,
    store_id: UUID,
    start: datetime,
    end: datetime,
) -> MonthKpi:
    stmt = (
        select(
            func.count(Car.id).label("cnt"),
            func.coalesce(func.sum(Car.expected_sell_price), 0).label("sales"),
            func.coalesce(func.sum(Car.expected_profit), 0).label("profit"),
        )
        .where(
            Car.store_id == store_id,
            Car.status.notin_(UNSOLD_STATUSES),
            Car.updated_at >= start,
            Car.updated_at <= end,
        )
    )
    r = db.execute(stmt).one()
    count = int(r.cnt or 0)
    sales = int(Decimal(str(r.sales or 0)))
    profit = int(Decimal(str(r.profit or 0)))
    profit_rate = float(profit / sales) if sales > 0 else 0.0
    return MonthKpi(count=count, sales=sales, profit=profit, profit_rate=profit_rate)


# ============================================================
# Endpoints
# ============================================================

@router.get("/sales/summary", response_model=SalesSummaryOut)
def sales_summary(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> SalesSummaryOut:
    store_id = _store_id(request)
    start, end = _month_window(year, month)

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start, prev_end = _month_window(prev_year, prev_month)

    this_kpi = _kpi_for_window(db, store_id, start, end)
    prev_kpi = _kpi_for_window(db, store_id, prev_start, prev_end)

    inv_stmt = (
        select(func.count(Car.id))
        .where(Car.store_id == store_id, Car.status == "在庫")
    )
    inventory_count = int(db.execute(inv_stmt).scalar() or 0)

    neg_stmt = (
        select(func.count(Car.id))
        .where(Car.store_id == store_id, Car.status == "商談中")
    )
    negotiating_count = int(db.execute(neg_stmt).scalar() or 0)

    return SalesSummaryOut(
        year=year,
        month=month,
        this_month=this_kpi,
        prev_month=prev_kpi,
        inventory_count=inventory_count,
        negotiating_count=negotiating_count,
    )


@router.get("/sales/monthly", response_model=SalesMonthlyOut)
def sales_monthly(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db),
) -> SalesMonthlyOut:
    store_id = _store_id(request)
    rows: list[SalesMonthlyRow] = []
    for m in range(1, 13):
        start, end = _month_window(year, m)
        kpi = _kpi_for_window(db, store_id, start, end)
        rows.append(
            SalesMonthlyRow(
                year=year,
                month=m,
                count=kpi.count,
                sales=kpi.sales,
                profit=kpi.profit,
                profit_rate=kpi.profit_rate,
            )
        )
    return SalesMonthlyOut(year=year, rows=rows)


@router.get("/sales/by-car", response_model=SalesByCarOut)
def sales_by_car(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> SalesByCarOut:
    store_id = _store_id(request)
    start, end = _month_window(year, month)

    stmt = (
        select(Car, User.name.label("staff_name"))
        .outerjoin(User, User.id == Car.user_id)
        .where(
            Car.store_id == store_id,
            Car.status.notin_(UNSOLD_STATUSES),
            Car.updated_at >= start,
            Car.updated_at <= end,
        )
        .order_by(Car.updated_at.desc())
    )

    rows: list[SalesByCarRow] = []
    for car, staff_name in db.execute(stmt).all():
        sold_at = ""
        if car.updated_at:
            try:
                sold_at = car.updated_at.date().isoformat()
            except Exception:
                pass
        rows.append(
            SalesByCarRow(
                car_id=str(car.id),
                stock_no=car.stock_no or "",
                make=car.make or "",
                model=car.model or "",
                status=car.status or "",
                buy_price=car.expected_buy_price,
                sell_price=car.expected_sell_price,
                profit=car.expected_profit,
                profit_rate=car.expected_profit_rate,
                staff_name=staff_name,
                sold_at=sold_at,
            )
        )

    return SalesByCarOut(year=year, month=month, rows=rows)


@router.get("/sales/by-staff", response_model=SalesByStaffOut)
def sales_by_staff(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> SalesByStaffOut:
    store_id = _store_id(request)
    start, end = _month_window(year, month)

    stmt = (
        select(
            Car.user_id,
            User.name.label("staff_name"),
            func.count(Car.id).label("cnt"),
            func.coalesce(func.sum(Car.expected_sell_price), 0).label("sales"),
            func.coalesce(func.sum(Car.expected_profit), 0).label("profit"),
        )
        .outerjoin(User, User.id == Car.user_id)
        .where(
            Car.store_id == store_id,
            Car.status.notin_(UNSOLD_STATUSES),
            Car.updated_at >= start,
            Car.updated_at <= end,
        )
        .group_by(Car.user_id, User.name)
        .order_by(func.sum(Car.expected_sell_price).desc())
    )

    rows: list[SalesByStaffRow] = []
    for r in db.execute(stmt).all():
        sales = int(Decimal(str(r.sales or 0)))
        profit = int(Decimal(str(r.profit or 0)))
        rows.append(
            SalesByStaffRow(
                user_id=str(r.user_id),
                staff_name=r.staff_name or "（名称なし）",
                count=int(r.cnt or 0),
                total_sales=sales,
                total_profit=profit,
                avg_profit_rate=float(profit / sales) if sales > 0 else 0.0,
            )
        )

    return SalesByStaffOut(year=year, month=month, rows=rows)


@router.get("/sales/inventory-stats", response_model=InventoryStatsOut)
def inventory_stats(
    request: Request,
    db: Session = Depends(get_db),
) -> InventoryStatsOut:
    store_id = _store_id(request)

    inv_stmt = (
        select(
            func.count(Car.id).label("cnt"),
            func.coalesce(func.sum(Car.expected_buy_price), 0).label("cost"),
        )
        .where(Car.store_id == store_id, Car.status == "在庫")
    )
    inv = db.execute(inv_stmt).one()

    neg_stmt = (
        select(func.count(Car.id))
        .where(Car.store_id == store_id, Car.status == "商談中")
    )
    neg_count = int(db.execute(neg_stmt).scalar() or 0)

    return InventoryStatsOut(
        total_count=int(inv.cnt or 0),
        total_cost=int(Decimal(str(inv.cost or 0))),
        negotiating_count=neg_count,
    )
