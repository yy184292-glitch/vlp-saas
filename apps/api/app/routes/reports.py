from __future__ import annotations

from datetime import date, datetime, time, timezone, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.models.inventory import StockMoveORM, InventoryItemORM
from app.models.work import WorkORM
from app.schemas.reports import (
    SalesMode,
    ProfitSummaryOut,
    ProfitDailyOut,
    ProfitDailyRowOut,
    ProfitMonthlyOut,
    ProfitMonthlyRowOut,
    ProfitByWorkOut,
    ProfitByWorkRowOut,
    CostByItemOut,
    CostByItemRowOut,
    DashboardSummaryOut,
)

router = APIRouter(tags=["reports"])


def _get_actor_store_id(request: Request) -> Optional[UUID]:
    user = getattr(request.state, "user", None)
    store_id = getattr(user, "store_id", None)

    if isinstance(store_id, UUID):
        return store_id

    if isinstance(store_id, str):
        try:
            return UUID(store_id)
        except Exception:
            return None

    return None


def _date_range(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    start = datetime.combine(date_from, time.min).replace(tzinfo=timezone.utc)
    end = datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=timezone.utc)
    return start, end


def _resolve_store_id(request: Request, store_id: UUID | None) -> UUID:
    actor_store_id = _get_actor_store_id(request)
    resolved = store_id or actor_store_id
    if not resolved:
        raise HTTPException(status_code=400, detail="store_id required")
    return resolved


def _sum_sales(
    *,
    db: Session,
    store_id: UUID,
    start: datetime,
    end: datetime,
    sales_mode: SalesMode,
) -> int:
    """売上を税抜(lines.amount) or 税込(billing.total) で返す"""
    if sales_mode == "exclusive":
        stmt = (
            select(func.coalesce(func.sum(BillingLineORM.amount), 0))
            .select_from(BillingLineORM)
            .join(BillingDocumentORM, BillingDocumentORM.id == BillingLineORM.billing_id)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
        )
    else:
        stmt = (
            select(func.coalesce(func.sum(BillingDocumentORM.total), 0))
            .select_from(BillingDocumentORM)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
        )

    val = db.execute(stmt).scalar() or 0
    return int(Decimal(str(val)))


def _sum_cost(
    *,
    db: Session,
    store_id: UUID,
    start: datetime,
    end: datetime,
) -> int:
    """
    原価は stock_moves(out) の qty * unit_cost の合計。
    issued_at と揃えるため Billing に JOIN して期間判定は issued_at で行う。
    """
    stmt = (
        select(func.coalesce(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost), 0))
        .select_from(StockMoveORM)
        .join(BillingDocumentORM, BillingDocumentORM.id == StockMoveORM.ref_id)
        .where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.move_type == "out",
            StockMoveORM.ref_type.in_(["billing_issue", "billing_update"]),
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
    )

    val = db.execute(stmt).scalar() or 0
    return int(Decimal(str(val)))


# ============================================================
# Profit Summary
# ============================================================

@router.get("/reports/profit-summary", response_model=ProfitSummaryOut)
def profit_summary(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    sales_mode: SalesMode = Query(default="exclusive"),
    db: Session = Depends(get_db),
) -> ProfitSummaryOut:
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    sales = _sum_sales(db=db, store_id=store_id, start=start, end=end, sales_mode=sales_mode)
    cost = _sum_cost(db=db, store_id=store_id, start=start, end=end)

    profit = sales - cost
    margin_rate = float(profit / sales) if sales > 0 else 0.0

    return ProfitSummaryOut(
        date_from=date_from,
        date_to=date_to,
        sales=sales,
        cost=cost,
        profit=profit,
        margin_rate=margin_rate,
    )


# ============================================================
# Profit Daily
# ============================================================

@router.get("/reports/profit-daily", response_model=ProfitDailyOut)
def profit_daily(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    sales_mode: SalesMode = Query(default="exclusive"),
    db: Session = Depends(get_db),
) -> ProfitDailyOut:
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    day = func.date_trunc("day", BillingDocumentORM.issued_at).label("day")

    # sales grouped
    if sales_mode == "exclusive":
        sales_stmt = (
            select(day, func.coalesce(func.sum(BillingLineORM.amount), 0).label("sales"))
            .select_from(BillingLineORM)
            .join(BillingDocumentORM, BillingDocumentORM.id == BillingLineORM.billing_id)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
            .group_by(day)
        )
    else:
        sales_stmt = (
            select(day, func.coalesce(func.sum(BillingDocumentORM.total), 0).label("sales"))
            .select_from(BillingDocumentORM)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
            .group_by(day)
        )

    sales_rows = {r.day.date(): int(Decimal(str(r.sales or 0))) for r in db.execute(sales_stmt).all()}

    # cost grouped (join billing to use issued_at)
    cost_stmt = (
        select(day, func.coalesce(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost), 0).label("cost"))
        .select_from(StockMoveORM)
        .join(BillingDocumentORM, BillingDocumentORM.id == StockMoveORM.ref_id)
        .where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.move_type == "out",
            StockMoveORM.ref_type.in_(["billing_issue", "billing_update"]),
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
        .group_by(day)
    )
    cost_rows = {r.day.date(): int(Decimal(str(r.cost or 0))) for r in db.execute(cost_stmt).all()}

    days = sorted(set(sales_rows.keys()) | set(cost_rows.keys()))
    rows = [
        ProfitDailyRowOut(
            day=d,
            sales=sales_rows.get(d, 0),
            cost=cost_rows.get(d, 0),
            profit=sales_rows.get(d, 0) - cost_rows.get(d, 0),
        )
        for d in days
    ]

    return ProfitDailyOut(date_from=date_from, date_to=date_to, rows=rows)


# ============================================================
# Profit Monthly
# ============================================================

@router.get("/reports/profit-monthly", response_model=ProfitMonthlyOut)
def profit_monthly(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    sales_mode: SalesMode = Query(default="exclusive"),
    db: Session = Depends(get_db),
) -> ProfitMonthlyOut:
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    month = func.date_trunc("month", BillingDocumentORM.issued_at).label("month")

    # sales grouped
    if sales_mode == "exclusive":
        sales_stmt = (
            select(month, func.coalesce(func.sum(BillingLineORM.amount), 0).label("sales"))
            .select_from(BillingLineORM)
            .join(BillingDocumentORM, BillingDocumentORM.id == BillingLineORM.billing_id)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
            .group_by(month)
        )
    else:
        sales_stmt = (
            select(month, func.coalesce(func.sum(BillingDocumentORM.total), 0).label("sales"))
            .select_from(BillingDocumentORM)
            .where(
                BillingDocumentORM.store_id == store_id,
                BillingDocumentORM.kind == "invoice",
                BillingDocumentORM.status == "issued",
                BillingDocumentORM.issued_at >= start,
                BillingDocumentORM.issued_at < end,
            )
            .group_by(month)
        )

    sales_rows = {r.month.date(): int(Decimal(str(r.sales or 0))) for r in db.execute(sales_stmt).all()}

    # cost grouped
    cost_stmt = (
        select(month, func.coalesce(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost), 0).label("cost"))
        .select_from(StockMoveORM)
        .join(BillingDocumentORM, BillingDocumentORM.id == StockMoveORM.ref_id)
        .where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.move_type == "out",
            StockMoveORM.ref_type.in_(["billing_issue", "billing_update"]),
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
        .group_by(month)
    )
    cost_rows = {r.month.date(): int(Decimal(str(r.cost or 0))) for r in db.execute(cost_stmt).all()}

    months = sorted(set(sales_rows.keys()) | set(cost_rows.keys()))
    rows = [
        ProfitMonthlyRowOut(
            month=m,
            sales=sales_rows.get(m, 0),
            cost=cost_rows.get(m, 0),
            profit=sales_rows.get(m, 0) - cost_rows.get(m, 0),
        )
        for m in months
    ]

    return ProfitMonthlyOut(date_from=date_from, date_to=date_to, rows=rows)


# ============================================================
# Cost By Item (stock_moves)
# ============================================================

@router.get("/reports/cost-by-item", response_model=CostByItemOut)
def cost_by_item(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> CostByItemOut:
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    stmt = (
        select(
            InventoryItemORM.id.label("item_id"),
            InventoryItemORM.name.label("item_name"),
            func.coalesce(func.sum(StockMoveORM.qty), 0).label("qty"),
            func.coalesce(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost), 0).label("cost"),
        )
        .select_from(StockMoveORM)
        .join(InventoryItemORM, InventoryItemORM.id == StockMoveORM.item_id)
        .join(BillingDocumentORM, BillingDocumentORM.id == StockMoveORM.ref_id)
        .where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.move_type == "out",
            StockMoveORM.ref_type.in_(["billing_issue", "billing_update"]),
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
        .group_by(InventoryItemORM.id, InventoryItemORM.name)
        .order_by(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost).desc())
    )

    rows = [
        CostByItemRowOut(
            item_id=r.item_id,
            item_name=r.item_name or "(unknown)",
            qty=float(r.qty or 0),
            cost=int(Decimal(str(r.cost or 0))),
        )
        for r in db.execute(stmt).all()
    ]

    return CostByItemOut(date_from=date_from, date_to=date_to, rows=rows)


# ============================================================
# Profit By Work
# ============================================================

@router.get("/reports/profit-by-work", response_model=ProfitByWorkOut)
def profit_by_work(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    sales_mode: SalesMode = Query(default="exclusive"),
    db: Session = Depends(get_db),
) -> ProfitByWorkOut:
    """
    stock_moves は請求(ref_id=billing_id)単位でしか紐付かないため、
    1請求に複数workがある場合は「請求内売上比」で原価を按分する。
    （DB変更なしで現実的な精度）
    """
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    # 1) 対象請求のID一覧
    bills_stmt = (
        select(BillingDocumentORM.id)
        .where(
            BillingDocumentORM.store_id == store_id,
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
    )
    billing_ids = [r[0] for r in db.execute(bills_stmt).all()]
    if not billing_ids:
        return ProfitByWorkOut(date_from=date_from, date_to=date_to, rows=[])

    # 2) work別売上（全体集計）
    if sales_mode == "exclusive":
        sales_by_work_stmt = (
            select(
                BillingLineORM.work_id.label("work_id"),
                func.coalesce(func.sum(BillingLineORM.amount), 0).label("sales"),
            )
            .where(
                BillingLineORM.billing_id.in_(billing_ids),
                BillingLineORM.work_id.isnot(None),
            )
            .group_by(BillingLineORM.work_id)
        )
    else:
        # inclusive は請求totalをworkに分解する必要があるため、後で請求内比率で配分する
        # ここでは "work別の税抜売上" を比率用に使う
        sales_by_work_stmt = (
            select(
                BillingLineORM.work_id.label("work_id"),
                func.coalesce(func.sum(BillingLineORM.amount), 0).label("sales"),
            )
            .where(
                BillingLineORM.billing_id.in_(billing_ids),
                BillingLineORM.work_id.isnot(None),
            )
            .group_by(BillingLineORM.work_id)
        )

    sales_by_work = {r.work_id: Decimal(str(r.sales or 0)) for r in db.execute(sales_by_work_stmt).all()}

    work_ids = list(sales_by_work.keys())
    work_name_by_id: dict[UUID, str] = {}
    if work_ids:
        work_rows = db.execute(select(WorkORM.id, WorkORM.name).where(WorkORM.id.in_(work_ids))).all()
        work_name_by_id = {w.id: (w.name or "").strip() for w in work_rows}

    # 3) 請求ごとの原価
    bill_cost_stmt = (
        select(
            StockMoveORM.ref_id.label("billing_id"),
            func.coalesce(func.sum(StockMoveORM.qty * StockMoveORM.unit_cost), 0).label("cost"),
        )
        .where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.move_type == "out",
            StockMoveORM.ref_type.in_(["billing_issue", "billing_update"]),
            StockMoveORM.ref_id.in_(billing_ids),
        )
        .group_by(StockMoveORM.ref_id)
    )
    bill_cost = {r.billing_id: Decimal(str(r.cost or 0)) for r in db.execute(bill_cost_stmt).all()}

    # 4) 請求内のwork別売上（比率用）
    bill_work_sales_stmt = (
        select(
            BillingLineORM.billing_id.label("billing_id"),
            BillingLineORM.work_id.label("work_id"),
            func.coalesce(func.sum(BillingLineORM.amount), 0).label("sales"),
        )
        .where(
            BillingLineORM.billing_id.in_(billing_ids),
            BillingLineORM.work_id.isnot(None),
        )
        .group_by(BillingLineORM.billing_id, BillingLineORM.work_id)
    )
    bill_work_rows = db.execute(bill_work_sales_stmt).all()

    bill_total_sales: dict[UUID, Decimal] = {}
    for r in bill_work_rows:
        bill_total_sales[r.billing_id] = bill_total_sales.get(r.billing_id, Decimal("0")) + Decimal(str(r.sales or 0))

    alloc_cost_by_work: dict[UUID, Decimal] = {wid: Decimal("0") for wid in work_ids}
    alloc_sales_by_work: dict[UUID, Decimal] = {wid: Decimal("0") for wid in work_ids}

    for r in bill_work_rows:
        bid = r.billing_id
        wid = r.work_id
        if not wid:
            continue

        # sales allocation
        line_sales = Decimal(str(r.sales or 0))
        alloc_sales_by_work[wid] = alloc_sales_by_work.get(wid, Decimal("0")) + line_sales

        # cost allocation
        c = bill_cost.get(bid, Decimal("0"))
        total = bill_total_sales.get(bid, Decimal("0"))
        if c > 0 and total > 0 and line_sales > 0:
            alloc_cost_by_work[wid] = alloc_cost_by_work.get(wid, Decimal("0")) + (c * line_sales / total)

    # sales_mode inclusive の場合は、最終的に「請求total」を work 比率で按分した売上として返したい
    if sales_mode == "inclusive":
        bill_total_stmt = (
            select(BillingDocumentORM.id, BillingDocumentORM.total)
            .where(BillingDocumentORM.id.in_(billing_ids))
        )
        bill_total = {r.id: Decimal(str(r.total or 0)) for r in db.execute(bill_total_stmt).all()}

        alloc_sales_by_work = {wid: Decimal("0") for wid in work_ids}
        for r in bill_work_rows:
            bid = r.billing_id
            wid = r.work_id
            if not wid:
                continue

            total = bill_total_sales.get(bid, Decimal("0"))
            if total <= 0:
                continue

            ratio = Decimal(str(r.sales or 0)) / total
            alloc_sales_by_work[wid] = alloc_sales_by_work.get(wid, Decimal("0")) + (bill_total.get(bid, Decimal("0")) * ratio)

    rows: list[ProfitByWorkRowOut] = []
    for wid in work_ids:
        sales_int = int(Decimal(str(alloc_sales_by_work.get(wid, Decimal("0")))))
        cost_int = int(Decimal(str(alloc_cost_by_work.get(wid, Decimal("0")))))
        rows.append(
            ProfitByWorkRowOut(
                work_id=wid,
                work_name=work_name_by_id.get(wid) or "(no name)",
                sales=sales_int,
                cost=cost_int,
                profit=sales_int - cost_int,
            )
        )

    rows.sort(key=lambda x: (x.profit, x.sales), reverse=True)
    return ProfitByWorkOut(date_from=date_from, date_to=date_to, rows=rows)


# ============================================================
# Dashboard Summary
# ============================================================

@router.get("/dashboard/summary", response_model=DashboardSummaryOut)
def dashboard_summary(
    request: Request,
    date_from: date,
    date_to: date,
    store_id: UUID | None = Query(default=None),
    sales_mode: SalesMode = Query(default="exclusive"),
    db: Session = Depends(get_db),
) -> DashboardSummaryOut:
    store_id = _resolve_store_id(request, store_id)
    start, end = _date_range(date_from, date_to)

    # issued count
    issued_count_stmt = (
        select(func.count(BillingDocumentORM.id))
        .where(
            BillingDocumentORM.store_id == store_id,
            BillingDocumentORM.kind == "invoice",
            BillingDocumentORM.status == "issued",
            BillingDocumentORM.issued_at >= start,
            BillingDocumentORM.issued_at < end,
        )
    )
    issued_count = int(db.execute(issued_count_stmt).scalar() or 0)

    sales = _sum_sales(db=db, store_id=store_id, start=start, end=end, sales_mode=sales_mode)
    cost = _sum_cost(db=db, store_id=store_id, start=start, end=end)

    profit = sales - cost
    margin_rate = float(profit / sales) if sales > 0 else 0.0

    # inventory valuation（簡易：現在庫 * 原価単価）
    inv_stmt = (
        select(func.coalesce(func.sum(InventoryItemORM.qty_on_hand * InventoryItemORM.cost_price), 0))
        .where(InventoryItemORM.store_id == store_id)
    )
    inventory_value = int(Decimal(str(db.execute(inv_stmt).scalar() or 0)))

    return DashboardSummaryOut(
        date_from=date_from,
        date_to=date_to,
        sales=sales,
        cost=cost,
        profit=profit,
        margin_rate=margin_rate,
        issued_count=issued_count,
        inventory_value=inventory_value,
    )