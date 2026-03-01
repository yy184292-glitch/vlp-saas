from __future__ import annotations

import csv
import io
import json
import traceback
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
from typing import Any, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session



from app.models.work import WorkORM
from app.models.work_material import WorkMaterialORM
from app.models.inventory import InventoryItemORM, StockMoveORM


from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.models.system_setting import SystemSettingORM
from app.schemas.billing import (
    BillingCreateIn,
    BillingImportIn,
    BillingImportOut,
    BillingLineIn,
    BillingLineOut,
    BillingOut,
    BillingUpdateIn,
    BillingVoidIn,
)

router = APIRouter(tags=["billing"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _jsonb_safe(v: Any) -> Any:
    # JSON serializable に寄せる（datetime/Decimal 等が混ざる可能性に備える）
    return json.loads(json.dumps(v, default=str))


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


def _assert_scope(doc: BillingDocumentORM, store_id: Optional[UUID]) -> None:
    # 互換: doc.store_id が None のデータは許可（移行期間向け）
    if doc.store_id is None:
        return
    if store_id is None:
        return
    if doc.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")


def _to_out(doc: BillingDocumentORM) -> BillingOut:
    return BillingOut(
        id=doc.id,
        store_id=doc.store_id,
        customer_id=getattr(doc, "customer_id", None),
        kind=doc.kind,
        status=doc.status,
        doc_no=getattr(doc, "doc_no", None),
        customer_name=doc.customer_name,
        subtotal=doc.subtotal,
        tax_total=doc.tax_total,
        total=doc.total,
        tax_rate=doc.tax_rate,
        tax_mode=doc.tax_mode,
        tax_rounding=doc.tax_rounding,
        issued_at=doc.issued_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )

def _resolve_line_from_work(
    db: Session,
    store_id: UUID,
    ln: BillingLineIn,
) -> tuple[str, Optional[str], int, int]:
    """
    work_id がある場合、作業マスタから snapshot を確定する
    戻り値: name, unit, unit_price, cost_price
    """
    if not getattr(ln, "work_id", None):
        return (
            ln.name,
            ln.unit,
            int(ln.unit_price or 0),
            int(ln.cost_price or 0),
        )

    work = db.get(WorkORM, ln.work_id)
    if not work or work.store_id != store_id:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid work_id: {ln.work_id}",
        )

    return (
        work.name,
        work.unit,
        int(work.unit_price or 0),
        int(getattr(work, "cost_price", 0) or 0),
    )


def _has_stock_consumed_for_billing(db: Session, billing_id: UUID) -> bool:
    """
    billing(issue) による在庫消費が既に行われたか（冪等化）
    """
    row = db.execute(
        select(StockMoveORM.id).where(
            StockMoveORM.ref_type == "billing_issue",
            StockMoveORM.ref_id == billing_id,
        ).limit(1)
    ).first()
    return row is not None


def _has_stock_restored_for_billing(db: Session, billing_id: UUID) -> bool:
    """
    billing(void) による在庫戻しが既に行われたか（冪等化）
    """
    row = db.execute(
        select(StockMoveORM.id).where(
            StockMoveORM.ref_type == "billing_void",
            StockMoveORM.ref_id == billing_id,
        ).limit(1)
    ).first()
    return row is not None


def _consume_inventory_for_billing_issue(
    db: Session,
    store_id: UUID,
    billing_id: UUID,
    now: datetime,
):
    """
    invoice issue 時に在庫を消費する（BOM → stock_moves out → qty_on_hand 減算）
    - 冪等：既に消費済みなら何もしない
    - work_id が無い明細は消費対象外
    """
    if _has_stock_consumed_for_billing(db, billing_id):
        return

    # 明細取得
    bill_lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    # BOM を引いて item ごとに消費量を集計（同じ item が複数行に出てもまとめる）
    consume_map: dict[UUID, Decimal] = {}

    for ln in bill_lines:
        work_id = getattr(ln, "work_id", None)
        if not work_id:
            continue

        qty = Decimal(str(getattr(ln, "qty", 0) or 0))
        if qty <= 0:
            continue

        materials = db.execute(
            select(WorkMaterialORM).where(
                WorkMaterialORM.store_id == store_id,
                WorkMaterialORM.work_id == work_id,
            )
        ).scalars().all()

        for mat in materials:
            item_id = mat.item_id
            per = Decimal(str(mat.qty_per_work or 0))
            if per <= 0:
                continue

            consume_qty = per * qty
            consume_map[item_id] = consume_map.get(item_id, Decimal("0")) + consume_qty

    # 在庫チェック＆更新（不足ならここで止める）
    for item_id, consume_qty in consume_map.items():
        item = db.get(InventoryItemORM, item_id)
        if not item or item.store_id != store_id:
            raise HTTPException(status_code=400, detail=f"Invalid inventory item: {item_id}")

        if Decimal(str(item.qty_on_hand)) < consume_qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock: {item.name}")

    # 消費確定（qty_on_hand 減算 + 台帳 out）
    for item_id, consume_qty in consume_map.items():
        item = db.get(InventoryItemORM, item_id)
        assert item is not None

        item.qty_on_hand = Decimal(str(item.qty_on_hand)) - consume_qty

        db.add(
            StockMoveORM(
                store_id=store_id,
                item_id=item.id,
                move_type="out",
                qty=consume_qty,
                unit_cost=item.cost_price,  # issue 時点の原価をスナップショット
                ref_type="billing_issue",
                ref_id=billing_id,
                note=None,
                created_at=now,
            )
        )


def _restore_inventory_for_billing_void(
    db: Session,
    store_id: UUID,
    billing_id: UUID,
    now: datetime,
):
    """
    invoice void 時に在庫を戻す（issue で作られた stock_moves out を元に戻す）
    - 冪等：既に戻し済みなら何もしない
    - issue 消費が無いなら何もしない
    """
    if _has_stock_restored_for_billing(db, billing_id):
        return
    if not _has_stock_consumed_for_billing(db, billing_id):
        return

    issued_moves = db.execute(
        select(StockMoveORM).where(
            StockMoveORM.ref_type == "billing_issue",
            StockMoveORM.ref_id == billing_id,
        )
    ).scalars().all()

    # itemごとに戻し数量集計
    restore_map: dict[UUID, Decimal] = {}
    for mv in issued_moves:
        restore_map[mv.item_id] = restore_map.get(mv.item_id, Decimal("0")) + Decimal(str(mv.qty or 0))

    for item_id, restore_qty in restore_map.items():
        if restore_qty <= 0:
            continue

        item = db.get(InventoryItemORM, item_id)
        if not item or item.store_id != store_id:
            # マスタが消えてても台帳整合性のためエラーにする（戻し不能）
            raise HTTPException(status_code=400, detail=f"Invalid inventory item: {item_id}")

        item.qty_on_hand = Decimal(str(item.qty_on_hand)) + restore_qty

        db.add(
            StockMoveORM(
                store_id=store_id,
                item_id=item.id,
                move_type="in",
                qty=restore_qty,
                unit_cost=item.cost_price,  # 戻しは現時点原価でOK（損益計算は issue move を基準にする）
                ref_type="billing_void",
                ref_id=billing_id,
                note=None,
                created_at=now,
            )
        )

def _build_required_consumption_map(
    db: Session,
    store_id: UUID,
    billing_id: UUID,
) -> dict[UUID, Decimal]:
    """
    現在の billing_lines を元に、BOMから「本来消費すべき数量」を item_id -> qty で返す
    """
    bill_lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    required: dict[UUID, Decimal] = {}

    for ln in bill_lines:
        work_id = getattr(ln, "work_id", None)
        if not work_id:
            continue

        qty = Decimal(str(getattr(ln, "qty", 0) or 0))
        if qty <= 0:
            continue

        materials = db.execute(
            select(WorkMaterialORM).where(
                WorkMaterialORM.store_id == store_id,
                WorkMaterialORM.work_id == work_id,
            )
        ).scalars().all()

        for mat in materials:
            per = Decimal(str(mat.qty_per_work or 0))
            if per <= 0:
                continue
            consume_qty = per * qty
            required[mat.item_id] = required.get(mat.item_id, Decimal("0")) + consume_qty

    return required


def _build_consumed_so_far_map(
    db: Session,
    store_id: UUID,
    billing_id: UUID,
) -> dict[UUID, Decimal]:
    """
    この請求書(ref_id=billing_id)で「これまで実際に動かした在庫量」を item_id -> qty(out-in) で返す
    対象ref_type:
      - billing_issue（発行時）
      - billing_update（発行後の差分調整）
      - billing_void（取消時の戻し）※ void したら issued じゃないので通常 update されないが念のため含めない
    """
    moves = db.execute(
        select(StockMoveORM).where(
            StockMoveORM.store_id == store_id,
            StockMoveORM.ref_id == billing_id,
            StockMoveORM.ref_type.in_(("billing_issue", "billing_update")),
        )
    ).scalars().all()

    consumed: dict[UUID, Decimal] = {}
    for mv in moves:
        q = Decimal(str(mv.qty or 0))
        if q <= 0:
            continue
        signed = q if mv.move_type == "out" else (-q if mv.move_type == "in" else Decimal("0"))
        if signed == 0:
            continue
        consumed[mv.item_id] = consumed.get(mv.item_id, Decimal("0")) + signed

    return consumed


def _reconcile_inventory_for_issued_billing_update(
    db: Session,
    store_id: UUID,
    billing_id: UUID,
    now: datetime,
):
    """
    発行済み(invoice issued)を更新したときの在庫差分調整（冪等）
    - required(現明細から再計算) と consumed_so_far(台帳集計) の差分だけ在庫を動かす
    - delta > 0: out（追加消費）
    - delta < 0: in（戻し）
    """
    required = _build_required_consumption_map(db, store_id, billing_id)
    consumed = _build_consumed_so_far_map(db, store_id, billing_id)

    item_ids = set(required.keys()) | set(consumed.keys())

    # まず不足チェック（追加消費が必要な分だけ）
    for item_id in item_ids:
        req = required.get(item_id, Decimal("0"))
        con = consumed.get(item_id, Decimal("0"))
        delta = req - con
        if delta <= 0:
            continue

        item = db.get(InventoryItemORM, item_id)
        if not item or item.store_id != store_id:
            raise HTTPException(status_code=400, detail=f"Invalid inventory item: {item_id}")

        if Decimal(str(item.qty_on_hand)) < delta:
            raise HTTPException(status_code=400, detail=f"Insufficient stock: {item.name}")

    # 差分適用
    for item_id in item_ids:
        req = required.get(item_id, Decimal("0"))
        con = consumed.get(item_id, Decimal("0"))
        delta = req - con

        if delta == 0:
            continue

        item = db.get(InventoryItemORM, item_id)
        if not item or item.store_id != store_id:
            raise HTTPException(status_code=400, detail=f"Invalid inventory item: {item_id}")

        if delta > 0:
            # 追加消費
            item.qty_on_hand = Decimal(str(item.qty_on_hand)) - delta
            db.add(
                StockMoveORM(
                    store_id=store_id,
                    item_id=item.id,
                    move_type="out",
                    qty=delta,
                    unit_cost=item.cost_price,
                    ref_type="billing_update",
                    ref_id=billing_id,
                    note="issued update delta (out)",
                    created_at=now,
                )
            )
        else:
            # 戻し（deltaは負）
            back = -delta
            item.qty_on_hand = Decimal(str(item.qty_on_hand)) + back
            db.add(
                StockMoveORM(
                    store_id=store_id,
                    item_id=item.id,
                    move_type="in",
                    qty=back,
                    unit_cost=item.cost_price,
                    ref_type="billing_update",
                    ref_id=billing_id,
                    note="issued update delta (in)",
                    created_at=now,
                )
            )



# ============================================================
# tax
# ============================================================

def _get_tax_defaults(db: Session) -> tuple[Decimal, str, str]:
    row = db.execute(select(SystemSettingORM).where(SystemSettingORM.key == "tax")).scalar_one_or_none()

    if not row or not isinstance(row.value, dict):
        return Decimal("0.10"), "exclusive", "floor"

    rate = Decimal(str(row.value.get("rate", "0.10")))
    mode = str(row.value.get("mode", "exclusive"))
    rounding = str(row.value.get("rounding", "floor"))
    return rate, mode, rounding


def _round_tax(value: Decimal, rounding: str) -> int:
    if rounding == "floor":
        return int(value.to_integral_value(rounding=ROUND_FLOOR))
    if rounding == "ceil":
        return int(value.to_integral_value(rounding=ROUND_CEILING))
    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def _recalc(
    lines: list[BillingLineIn],
    tax_rate: Decimal,
    tax_mode: str,
    tax_rounding: str,
) -> tuple[int, int, int]:
    subtotal = 0
    for ln in lines:
        qty = Decimal(str(ln.qty or 0))
        unit_price = Decimal(str(ln.unit_price or 0))
        subtotal += int(qty * unit_price)

    subtotal_dec = Decimal(subtotal)

    if tax_mode == "inclusive":
        tax = subtotal_dec * tax_rate / (Decimal("1") + tax_rate)
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal
    else:
        tax = subtotal_dec * tax_rate
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal + tax_total

    return subtotal, tax_total, total


# ============================================================
# doc_no sequence (atomic)
# ============================================================

from sqlalchemy import text

def _alloc_doc_no(db, store_id, kind, now):
    prefix = "INV" if kind == "invoice" else "EST"
    year = int(getattr(now, "year"))

    lock_key = f"billing:{prefix}:{year}"
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:k))"), {"k": lock_key})

    like = f"{prefix}-{year}-%"

    max_no = db.execute(
        text(
            r"""
            SELECT COALESCE(
                MAX(NULLIF(SUBSTRING(doc_no FROM '(\d{5})$'), '')::int),
                0
            )
            FROM billing_documents
            WHERE kind = :kind
              AND doc_no LIKE :like
            """
        ),
        {"kind": kind, "like": like},
    ).scalar_one()

    next_no = int(max_no) + 1
    return f"{prefix}-{year}-{next_no:05d}"
# ============================================================
# list / get
# ============================================================

@router.get("/billing", response_model=List[BillingOut])
def list_billing(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    status: str | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
) -> List[BillingOut]:
    stmt = select(BillingDocumentORM)

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None:
        stmt = stmt.where(BillingDocumentORM.store_id == actor_store_id)

    if status:
        stmt = stmt.where(BillingDocumentORM.status == status)
    if kind:
        stmt = stmt.where(BillingDocumentORM.kind == kind)

    stmt = stmt.order_by(BillingDocumentORM.created_at.desc()).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()
    return [_to_out(x) for x in rows]


@router.get("/billing/{billing_id}", response_model=BillingOut)
def get_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))
    return _to_out(doc)


# ============================================================
# lines
# ============================================================

@router.get("/billing/{billing_id}/lines", response_model=List[BillingLineOut])
def list_billing_lines(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> List[BillingLineOut]:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    stmt = (
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    )
    return db.execute(stmt).scalars().all()

# ============================================================
# create / update
# ============================================================

@router.post("/billing", response_model=BillingOut)
def create_billing(
    request: Request,
    body: BillingCreateIn,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    actor_store_id = _get_actor_store_id(request)
    store_id = actor_store_id or body.store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    tax_rate, tax_mode, tax_rounding = _get_tax_defaults(db)

    # NOTE: line は work_id 指定の場合でも、ここでは入力値で再計算するより
    #       マスタ確定後に計算するのが正しいので、先に line snapshot を確定してから計算する
    resolved_lines: list[tuple[BillingLineIn, str, Optional[str], int, int]] = []
    for ln in body.lines:
        name, unit, unit_price, cost_price = _resolve_line_from_work(db, store_id, ln)
        resolved_lines.append((ln, name, unit, unit_price, cost_price))

    # subtotal 等は snapshot 確定値で計算
    tmp_lines = []
    for ln, name, unit, unit_price, cost_price in resolved_lines:
        tmp_lines.append(
            BillingLineIn(
                work_id=getattr(ln, "work_id", None),
                name=name,
                qty=ln.qty,
                unit=unit,
                unit_price=unit_price,
                cost_price=cost_price,
            )
        )

    subtotal, tax_total, total = _recalc(
        tmp_lines,
        tax_rate,
        tax_mode,
        tax_rounding,
    )

    kind = body.kind or "invoice"
    doc_no = _alloc_doc_no(db, store_id, kind, now)

    issued_at = body.issued_at
    status = body.status or "draft"
    if status == "issued" and issued_at is None:
        issued_at = now

    doc = BillingDocumentORM(
        id=uuid4(),
        store_id=store_id,
        customer_id=getattr(body, "customer_id", None),
        kind=kind,
        status=status,
        doc_no=doc_no,
        customer_name=body.customer_name,
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
        tax_rate=tax_rate,
        tax_mode=tax_mode,
        tax_rounding=tax_rounding,
        issued_at=issued_at,
        source_work_order_id=getattr(body, "source_work_order_id", None),
        meta=_jsonb_safe(body.meta or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(doc)

    # 明細保存（B方式: 在庫はここでは動かさない）
    for i, (ln, name, unit, unit_price, cost_price) in enumerate(resolved_lines):
        qty_dec = Decimal(str(ln.qty or 0))
        amount = int(qty_dec * Decimal(unit_price))

        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=doc.id,
                work_id=getattr(ln, "work_id", None),
                name=name,
                qty=float(qty_dec),
                unit=unit,
                unit_price=int(unit_price),
                cost_price=int(cost_price),
                amount=amount,
                sort_order=i,
                created_at=now,
            )
        )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(doc)
    return _to_out(doc)


@router.put("/billing/{billing_id}", response_model=BillingOut)
def update_billing(
    request: Request,
    billing_id: UUID,
    body: BillingUpdateIn,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    if body.kind is not None:
        doc.kind = body.kind
        # kind変更を許すなら、doc_no再採番ポリシーが必要になるので通常は非推奨

    if body.status is not None:
        doc.status = body.status
        if body.status == "issued" and doc.issued_at is None:
            doc.issued_at = now

    if getattr(body, "customer_id", None) is not None:
        doc.customer_id = body.customer_id

    if body.customer_name is not None:
        doc.customer_name = body.customer_name

    if body.meta is not None:
        doc.meta = _jsonb_safe(body.meta)

    # 明細更新がある場合のみ差分在庫調整対象
    if body.lines is not None:
        if not doc.store_id:
            raise HTTPException(status_code=400, detail="store_id required")

        # まず新しい line snapshot を確定
        resolved_lines: list[tuple[BillingLineIn, str, Optional[str], int, int]] = []
        for ln in body.lines:
            name, unit, unit_price, cost_price = _resolve_line_from_work(db, doc.store_id, ln)
            resolved_lines.append((ln, name, unit, unit_price, cost_price))

        # 既存明細を削除して入れ替え
        db.execute(delete(BillingLineORM).where(BillingLineORM.billing_id == billing_id))

        # 金額を再計算（確定値で）
        tmp_lines = []
        for ln, name, unit, unit_price, cost_price in resolved_lines:
            tmp_lines.append(
                BillingLineIn(
                    work_id=getattr(ln, "work_id", None),
                    name=name,
                    qty=ln.qty,
                    unit=unit,
                    unit_price=unit_price,
                    cost_price=cost_price,
                )
            )

        subtotal, tax_total, total = _recalc(
            tmp_lines,
            doc.tax_rate,
            doc.tax_mode,
            doc.tax_rounding,
        )
        doc.subtotal = subtotal
        doc.tax_total = tax_total
        doc.total = total

        # 明細保存
        for i, (ln, name, unit, unit_price, cost_price) in enumerate(resolved_lines):
            qty_dec = Decimal(str(ln.qty or 0))
            amount = int(qty_dec * Decimal(unit_price))

            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    work_id=getattr(ln, "work_id", None),
                    name=name,
                    qty=float(qty_dec),
                    unit=unit,
                    unit_price=int(unit_price),
                    cost_price=int(cost_price),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

        # ★ issued(invoice) の場合だけ差分在庫調整（冪等）
        if doc.status == "issued" and doc.kind == "invoice":
            _reconcile_inventory_for_issued_billing_update(
                db=db,
                store_id=doc.store_id,
                billing_id=doc.id,
                now=now,
            )

    doc.updated_at = now

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(doc)
    return _to_out(doc)


# ============================================================
# issue / void
# ============================================================

@router.post("/billing/{billing_id}/issue", response_model=BillingOut)
def issue_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    # 既に issued なら冪等に返す（在庫消費も二重にしない）
    if doc.status == "issued":
        return _to_out(doc)

    # invoice だけ issue 対象（必要なら見積も許可に変更可）
    if doc.kind != "invoice":
        raise HTTPException(status_code=400, detail="Only invoice can be issued")

    # store_id 必須（在庫は store 単位）
    if not doc.store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    # 在庫消費（まだなら）
    _consume_inventory_for_billing_issue(
        db=db,
        store_id=doc.store_id,
        billing_id=billing_id,
        now=now,
    )

    doc.status = "issued"
    if doc.issued_at is None:
        doc.issued_at = now
    doc.updated_at = now

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(doc)
    return _to_out(doc)


@router.post("/billing/{billing_id}/void", response_model=BillingOut)
def void_billing(
    request: Request,
    billing_id: UUID,
    body: BillingVoidIn | None = None,
    db: Session = Depends(get_db),
) -> BillingOut:
    """
    発行済み請求書を取消(VOID)する。
    - issued の invoice のみ許可
    - 既に void の場合は冪等に成功
    - issue で消費した在庫を戻す（冪等）
    - 取消理由は doc.meta に保持（DB変更不要）
    """
    now = _utcnow()

    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_scope(doc, _get_actor_store_id(request))

    # 既に void なら冪等に返す
    if doc.status == "void":
        return _to_out(doc)

    # 「発行後取消」なので issued のみ許可（draft はまず削除 or update）
    if doc.status != "issued":
        raise HTTPException(status_code=400, detail="Only issued document can be voided")

    # 通常は invoice のみ取消対象にする（見積は取消というより編集/削除）
    if doc.kind != "invoice":
        raise HTTPException(status_code=400, detail="Only invoice can be voided")

    if not doc.store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    # NEW: issue で消費した在庫を戻す（既に戻し済みなら何もしない）
    _restore_inventory_for_billing_void(
        db=db,
        store_id=doc.store_id,
        billing_id=billing_id,
        now=now,
    )

    doc.status = "void"
    doc.updated_at = now

    # 理由は meta に保存（既存 meta を壊さない）
    if body and body.reason:
        meta = doc.meta if isinstance(doc.meta, dict) else {}
        meta["_void"] = {"reason": body.reason, "at": now.isoformat()}
        doc.meta = _jsonb_safe(meta)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(doc)
    return _to_out(doc)
# ============================================================
# convert estimate → invoice
# ============================================================

@router.post("/billing/{billing_id}/convert", response_model=BillingOut)
def convert_to_invoice(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    source = db.get(BillingDocumentORM, billing_id)
    if not source:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    _assert_scope(source, actor_store_id)

    if source.kind != "estimate":
        raise HTTPException(status_code=400, detail="Only estimate can convert")

    store_id = source.store_id or actor_store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    # lines copy
    src_lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == source.id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    invoice_id = uuid4()
    doc_no = _alloc_doc_no(db, store_id, "invoice", now)

    invoice = BillingDocumentORM(
        id=invoice_id,
        store_id=store_id,
        customer_id=getattr(source, "customer_id", None),
        kind="invoice",
        status="draft",
        doc_no=doc_no,
        customer_name=source.customer_name,
        subtotal=source.subtotal,
        tax_total=source.tax_total,
        total=source.total,
        tax_rate=source.tax_rate,
        tax_mode=source.tax_mode,
        tax_rounding=source.tax_rounding,
        issued_at=None,
        source_work_order_id=source.source_work_order_id,
        meta=_jsonb_safe(source.meta or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(invoice)

    for ln in src_lines:
        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=invoice_id,
                work_id=getattr(ln, "work_id", None),
                name=ln.name,
                qty=ln.qty,
                unit=ln.unit,
                unit_price=ln.unit_price,
                cost_price=ln.cost_price,
                amount=ln.amount,
                sort_order=ln.sort_order,
                created_at=now,
            )
        )

    db.commit()
    db.refresh(invoice)
    return _to_out(invoice)


# ============================================================
# delete
# ============================================================

@router.delete("/billing/{billing_id}")
def delete_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    # issued は物理削除禁止（取消は void を使う）
    if doc.status == "issued":
        raise HTTPException(
            status_code=400,
            detail="Issued document cannot be deleted. Use /void.",
        )

    db.execute(delete(BillingLineORM).where(BillingLineORM.billing_id == billing_id))
    db.delete(doc)
    db.commit()
    return {"deleted": True}


# ============================================================
# CSV export (1枚分)
# ============================================================

@router.get("/billing/{billing_id}/export.csv")
def export_billing_csv(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
):
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["billing_id", str(doc.id)])
    w.writerow(["doc_no", getattr(doc, "doc_no", "") or ""])
    w.writerow(["customer_id", str(getattr(doc, "customer_id", "") or "")])
    w.writerow(["customer_name", doc.customer_name or ""])
    w.writerow(["kind", doc.kind])
    w.writerow(["status", doc.status])
    w.writerow(["issued_at", doc.issued_at.isoformat() if doc.issued_at else ""])
    w.writerow([])
    w.writerow(["name", "qty", "unit_price", "amount"])

    for ln in lines:
        w.writerow([ln.name, ln.qty, ln.unit_price, ln.amount])

    w.writerow([])
    w.writerow(["subtotal", doc.subtotal])
    w.writerow(["tax_total", doc.tax_total])
    w.writerow(["total", doc.total])

    data = buf.getvalue().encode("utf-8-sig")  # Excel向けBOM

    filename = f"billing_{doc.id}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# PDF export (A4)
# ============================================================

@router.get("/billing/{billing_id}/export.pdf")
def export_billing_pdf(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
):
    import os
    from pathlib import Path

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    # ---- Fetch document ----
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    lines = (
        db.execute(
            select(BillingLineORM)
            .where(BillingLineORM.billing_id == billing_id)
            .order_by(BillingLineORM.sort_order.asc())
        )
        .scalars()
        .all()
    )

    # ---- Helpers ----
    def safe_int(v, default: int = 0) -> int:
        try:
            if v is None:
                return default
            return int(v)
        except Exception:
            return default

    def safe_float(v, default: float = 0.0) -> float:
        try:
            if v is None:
                return default
            return float(v)
        except Exception:
            return default

    def yen(v) -> str:
        return f"¥{safe_int(v):,}"

    def fmt_date(dt) -> str:
        if not dt:
            return "-"
        try:
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
        except Exception:
            return str(dt)

    def pick_attr(obj, names: list[str], default: str = "") -> str:
        """obj から候補属性を順に取り、最初に見つかった非空文字列を返す。"""
        if obj is None:
            return default
        for n in names:
            try:
                v = getattr(obj, n, None)
            except Exception:
                v = None
            if v is None:
                continue
            s = str(v).strip()
            if s:
                return s
        return default

    def pick_env(*keys: str, default: str = "") -> str:
        for k in keys:
            v = os.getenv(k)
            if v is None:
                continue
            s = str(v).strip()
            if s:
                return s
        return default

    try:
        # ---- PDF base ----
        width, height = A4
        margin_x = 40
        margin_top = 40
        margin_bottom = 40

        # ---- Font (Japanese) ----
        font_path = (
            Path(__file__).resolve().parents[1]
            / "assets"
            / "fonts"
            / "NotoSansJP-Regular.ttf"
        )

        use_jp_font = False
        try:
            if font_path.exists():
                try:
                    pdfmetrics.getFont("NotoSansJP")
                except Exception:
                    pdfmetrics.registerFont(TTFont("NotoSansJP", str(font_path)))
                use_jp_font = True
        except Exception:
            use_jp_font = False

        out = io.BytesIO()
        c = canvas.Canvas(out, pagesize=A4)

        def set_font(size: int, bold: bool = False) -> None:
            if use_jp_font:
                c.setFont("NotoSansJP", size)
            else:
                c.setFont("Helvetica-Bold" if bold else "Helvetica", size)

        # ============================================================
        # Master reflection:
        #   issuer: store master (fallback: env)
        #   recipient: customer master (fallback: snapshot customer_name)
        # ============================================================

        store = getattr(doc, "store", None)
        customer = getattr(doc, "customer", None)

        # store master → issuer
        issuer_name = pick_attr(store, ["name", "company_name", "display_name"], default="") or pick_env(
            "PDF_ISSUER_NAME",
            default="（会社名未設定）",
        )
        issuer_zip = pick_attr(store, ["zip", "postal_code", "postcode"], default="") or pick_env(
            "PDF_ISSUER_ZIP",
            default="",
        )
        issuer_addr = pick_attr(store, ["address", "addr", "address1"], default="") or pick_env(
            "PDF_ISSUER_ADDRESS",
            default="（住所未設定）",
        )
        issuer_tel = pick_attr(store, ["tel", "phone", "telephone"], default="") or pick_env(
            "PDF_ISSUER_TEL",
            default="",
        )
        issuer_email = pick_attr(store, ["email", "mail"], default="") or pick_env(
            "PDF_ISSUER_EMAIL",
            default="",
        )

        # customer master → recipient
        cust_name_master = pick_attr(customer, ["name", "company_name", "display_name"], default="")
        cust_name_snapshot = (getattr(doc, "customer_name", None) or "").strip()
        customer_name = cust_name_master or cust_name_snapshot or "-"

        customer_zip = pick_attr(customer, ["zip", "postal_code", "postcode"], default="")
        customer_addr = pick_attr(customer, ["address", "addr", "address1"], default="")
        customer_tel = pick_attr(customer, ["tel", "phone", "telephone"], default="")

        # ---- Document meta ----
        title = "請求書" if doc.kind == "invoice" else "見積書"
        doc_no = getattr(doc, "doc_no", None) or "-"
        issued_at = doc.issued_at if doc.issued_at else None

        customer_line = f"{customer_name} 御中" if customer_name != "-" else "-"

        # ---- Layout positions ----
        y = height - margin_top

        # Title (center)
        set_font(20, bold=True)
        c.drawCentredString(width / 2, y, title)
        y -= 28

        # Right block (doc no / date)
        set_font(10)
        right_x = width - margin_x
        c.drawRightString(right_x, y, f"発行日: {fmt_date(issued_at)}")
        y -= 14
        c.drawRightString(right_x, y, f"No: {doc_no}")
        y -= 14
        c.drawRightString(right_x, y, f"ID: {doc.id}")
        y -= 6

        # Customer block (left)
        y_customer = height - margin_top - 42
        set_font(12, bold=True)
        c.drawString(margin_x, y_customer, customer_line)
        c.line(margin_x, y_customer - 2, margin_x + 300, y_customer - 2)

        # Customer address lines (from customer master)
        set_font(9)
        y_customer -= 14
        if customer_zip:
            c.drawString(margin_x, y_customer, customer_zip)
            y_customer -= 12
        if customer_addr:
            # 長すぎると崩れるので軽くカット（必要なら折返しに拡張）
            c.drawString(margin_x, y_customer, customer_addr[:70])
            y_customer -= 12
        if customer_tel:
            c.drawString(margin_x, y_customer, f"TEL: {customer_tel}")
            y_customer -= 12

        # Issuer block (right)
        issuer_y = height - margin_top - 42
        set_font(9)
        c.drawRightString(right_x, issuer_y, issuer_name)
        issuer_y -= 12
        if issuer_zip:
            c.drawRightString(right_x, issuer_y, issuer_zip)
            issuer_y -= 12
        if issuer_addr:
            c.drawRightString(right_x, issuer_y, issuer_addr[:70])
            issuer_y -= 12
        if issuer_tel:
            c.drawRightString(right_x, issuer_y, f"TEL: {issuer_tel}")
            issuer_y -= 12
        if issuer_email:
            c.drawRightString(right_x, issuer_y, issuer_email)
            issuer_y -= 12

        # Summary (Total)
        y = height - margin_top - 110
        set_font(12, bold=True)
        c.drawString(margin_x, y, "合計金額")
        set_font(16, bold=True)
        c.drawString(margin_x + 80, y - 2, yen(doc.total))
        y -= 22

        set_font(9)
        if doc.kind == "invoice":
            c.drawString(margin_x, y, "※ お支払い期日・振込先などは備考欄をご確認ください。")
        else:
            c.drawString(margin_x, y, "※ 本見積の有効期限・条件などは備考欄をご確認ください。")
        y -= 16

        # Separator
        c.setStrokeColor(colors.black)
        c.setLineWidth(1)
        c.line(margin_x, y, width - margin_x, y)
        y -= 14

        # ---- Table header ----
        col_name_x = margin_x
        col_qty_x = width - margin_x - 220
        col_unit_x = width - margin_x - 120
        col_amt_x = width - margin_x

        set_font(10, bold=True)
        c.drawString(col_name_x, y, "品目")
        c.drawRightString(col_qty_x, y, "数量")
        c.drawRightString(col_unit_x, y, "単価")
        c.drawRightString(col_amt_x, y, "金額")
        y -= 8
        c.setLineWidth(0.7)
        c.line(margin_x, y, width - margin_x, y)
        y -= 12

        # ---- Rows ----
        set_font(10)
        row_height = 16

        def new_page() -> float:
            c.showPage()
            y2 = height - margin_top
            set_font(14, bold=True)
            c.drawString(margin_x, y2, title)
            set_font(9)
            c.drawRightString(width - margin_x, y2, f"No: {doc_no} / 発行日: {fmt_date(issued_at)}")
            y2 -= 18
            c.line(margin_x, y2, width - margin_x, y2)
            y2 -= 14

            set_font(10, bold=True)
            c.drawString(col_name_x, y2, "品目")
            c.drawRightString(col_qty_x, y2, "数量")
            c.drawRightString(col_unit_x, y2, "単価")
            c.drawRightString(col_amt_x, y2, "金額")
            y2 -= 8
            c.line(margin_x, y2, width - margin_x, y2)
            y2 -= 12
            set_font(10)
            return y2

        for ln in lines:
            if y < (margin_bottom + 120):
                y = new_page()

            name = (ln.name or "").strip() or "（未設定）"
            name = name[:60]

            qty = safe_float(getattr(ln, "qty", 0.0))
            unit_price = safe_int(getattr(ln, "unit_price", 0))
            amount = safe_int(getattr(ln, "amount", None), default=int(Decimal(str(qty)) * Decimal(str(unit_price))))

            c.drawString(col_name_x, y, name)
            c.drawRightString(col_qty_x, y, f"{qty:g}")
            c.drawRightString(col_unit_x, y, f"{unit_price:,}")
            c.drawRightString(col_amt_x, y, f"{amount:,}")
            y -= row_height

        c.setLineWidth(0.7)
        c.line(margin_x, y + 6, width - margin_x, y + 6)

        # ---- Totals box (right) ----
        box_w = 220
        box_h = 60
        box_x = width - margin_x - box_w
        box_y = max(margin_bottom + 40, y - box_h - 10)

        c.setLineWidth(0.7)
        c.rect(box_x, box_y, box_w, box_h, stroke=1, fill=0)

        set_font(10)
        c.drawString(box_x + 10, box_y + box_h - 18, "小計")
        c.drawRightString(box_x + box_w - 10, box_y + box_h - 18, yen(doc.subtotal))

        c.drawString(box_x + 10, box_y + box_h - 34, "消費税")
        c.drawRightString(box_x + box_w - 10, box_y + box_h - 34, yen(doc.tax_total))

        set_font(11, bold=True)
        c.drawString(box_x + 10, box_y + box_h - 52, "合計")
        c.drawRightString(box_x + box_w - 10, box_y + box_h - 52, yen(doc.total))

        # ---- Notes (bottom-left) ----
        note_x = margin_x
        note_y = margin_bottom + 70
        set_font(9, bold=True)
        c.drawString(note_x, note_y + 32, "備考")
        set_font(9)
        c.setLineWidth(0.5)
        c.rect(note_x, note_y, width - margin_x * 2 - box_w - 16, 40, stroke=1, fill=0)

        note = ""
        try:
            if isinstance(doc.meta, dict):
                note = (doc.meta.get("note") or doc.meta.get("notes") or "").strip()
        except Exception:
            note = ""

        # 任意の振込先等は環境変数で追記（あれば）
        bank_info = pick_env("PDF_BANK_INFO", default="")
        if bank_info:
            note = f"{note}\n振込先: {bank_info}" if note else f"振込先: {bank_info}"

        lines_note = (note.splitlines() if note else [])
        for i in range(min(2, len(lines_note))):
            c.drawString(note_x + 8, note_y + 26 - i * 14, lines_note[i][:60])

        c.save()
        out.seek(0)

        filename = f"{'invoice' if doc.kind == 'invoice' else 'estimate'}_{doc_no}_{doc.id}.pdf"
        return StreamingResponse(
            out,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
        )

# ============================================================
# IMPORT（既存維持）
# ============================================================

@router.post("/billing/import", response_model=BillingImportOut)
def import_billing(
    body: BillingImportIn,
    db: Session = Depends(get_db),
) -> BillingImportOut:
    now = _utcnow()
    inserted = 0

    for it in body.items:
        lines_in: list[BillingLineIn] = []
        for raw in (it.lines or []):
            if not isinstance(raw, dict):
                continue

            name = str(raw.get("name") or "明細").strip()
            if not name:
                continue

            try:
                qty = float(raw.get("qty") or 0)
            except Exception:
                qty = 0.0

            unit_price_raw = raw.get("unit_price")
            if unit_price_raw is None:
                unit_price_raw = raw.get("unitPrice")

            try:
                unit_price = int(unit_price_raw) if unit_price_raw is not None else 0
            except Exception:
                unit_price = 0

            unit = raw.get("unit")
            unit_s = str(unit).strip() if unit is not None else None

            lines_in.append(
                BillingLineIn(
                    name=name,
                    qty=qty,
                    unit=unit_s,
                    unit_price=unit_price,
                )
            )

        tax_rate, tax_mode, tax_rounding = _get_tax_defaults(db)
        subtotal, tax_total, total = _recalc(lines_in, tax_rate, tax_mode, tax_rounding)

        billing_id = uuid4()
        doc = BillingDocumentORM(
            id=billing_id,
            store_id=None,
            customer_id=None,
            kind=it.kind or "invoice",
            status=it.status or "draft",
            doc_no=None,
            customer_name=it.customerName,
            subtotal=subtotal,
            tax_total=tax_total,
            total=total,
            tax_rate=tax_rate,
            tax_mode=tax_mode,
            tax_rounding=tax_rounding,
            issued_at=now,
            source_work_order_id=None,
            meta=_jsonb_safe({"_import": "localStorage"}),
            created_at=now,
            updated_at=now,
        )
        db.add(doc)

        for i, ln in enumerate(lines_in):
            amount = int(Decimal(str(ln.qty or 0)) * Decimal(str(ln.unit_price or 0)))
            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=float(ln.qty or 0),
                    unit=ln.unit,
                    unit_price=int(ln.unit_price or 0),
                    cost_price=int(getattr(ln, "cost_price", 0) or 0),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

        inserted += 1

    db.commit()
    return BillingImportOut(inserted=inserted)