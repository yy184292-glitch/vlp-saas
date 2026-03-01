# app/routes/inventory.py
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inventory import InventoryItemORM, StockMoveORM
from app.schemas.inventory import (
    InventoryItemCreateIn,
    InventoryItemOut,
    InventoryItemUpdateIn,
    StockMoveCreateIn,
    StockMoveOut,
)

router = APIRouter(tags=["inventory"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


def _assert_store_scope(store_id: UUID, actor_store_id: Optional[UUID]) -> None:
    if actor_store_id and store_id != actor_store_id:
        raise HTTPException(status_code=404, detail="Not found")


def _require_store_id(request: Request, body_store_id: Optional[UUID]) -> UUID:
    actor_store_id = _get_actor_store_id(request)
    store_id = actor_store_id or body_store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


# ============================================================
# InventoryItem CRUD
# ============================================================

@router.get("/inventory/items", response_model=List[InventoryItemOut])
def list_inventory_items(
    request: Request,
    q: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[InventoryItemOut]:
    actor_store_id = _get_actor_store_id(request)
    if not actor_store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    stmt = select(InventoryItemORM).where(InventoryItemORM.store_id == actor_store_id)

    if q:
        stmt = stmt.where(InventoryItemORM.name.contains(q))

    stmt = stmt.order_by(InventoryItemORM.name.asc()).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


@router.post("/inventory/items", response_model=InventoryItemOut)
def create_inventory_item(
    request: Request,
    body: InventoryItemCreateIn,
    db: Session = Depends(get_db),
) -> InventoryItemOut:
    store_id = _require_store_id(request, body.store_id)
    _assert_store_scope(store_id, _get_actor_store_id(request))

    now = _utcnow()

    item = InventoryItemORM(
        id=uuid4(),
        store_id=store_id,
        sku=(body.sku.strip() if body.sku else None),
        name=body.name.strip(),
        unit=(body.unit.strip() if body.unit else None),
        cost_price=Decimal(str(body.cost_price or 0)),
        sale_price=Decimal(str(body.sale_price or 0)),
        qty_on_hand=Decimal(str(body.qty_on_hand or 0)),
        note=body.note,
        created_at=now,
        updated_at=now,
    )
    db.add(item)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(item)
    return item


@router.get("/inventory/items/{item_id}", response_model=InventoryItemOut)
def get_inventory_item(
    request: Request,
    item_id: UUID,
    db: Session = Depends(get_db),
) -> InventoryItemOut:
    item = db.get(InventoryItemORM, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(item.store_id, _get_actor_store_id(request))
    return item


@router.put("/inventory/items/{item_id}", response_model=InventoryItemOut)
def update_inventory_item(
    request: Request,
    item_id: UUID,
    body: InventoryItemUpdateIn,
    db: Session = Depends(get_db),
) -> InventoryItemOut:
    item = db.get(InventoryItemORM, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(item.store_id, _get_actor_store_id(request))

    if body.sku is not None:
        item.sku = body.sku.strip() if body.sku else None
    if body.name is not None:
        item.name = body.name.strip()
    if body.unit is not None:
        item.unit = body.unit.strip() if body.unit else None

    if body.cost_price is not None:
        item.cost_price = Decimal(str(body.cost_price))
    if body.sale_price is not None:
        item.sale_price = Decimal(str(body.sale_price))
    if body.qty_on_hand is not None:
        # 手動上書きは事故りやすいが、棚卸UIがない間の暫定として許可
        item.qty_on_hand = Decimal(str(body.qty_on_hand))

    if body.note is not None:
        item.note = body.note

    item.updated_at = _utcnow()

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(item)
    return item


@router.delete("/inventory/items/{item_id}")
def delete_inventory_item(
    request: Request,
    item_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    item = db.get(InventoryItemORM, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    _assert_store_scope(item.store_id, _get_actor_store_id(request))

    db.delete(item)
    db.commit()
    return {"deleted": True}


# ============================================================
# Stock moves (manual)
# ============================================================

@router.get("/inventory/moves", response_model=List[StockMoveOut])
def list_stock_moves(
    request: Request,
    item_id: Optional[UUID] = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[StockMoveOut]:
    actor_store_id = _get_actor_store_id(request)
    if not actor_store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    stmt = select(StockMoveORM).where(StockMoveORM.store_id == actor_store_id)

    if item_id:
        stmt = stmt.where(StockMoveORM.item_id == item_id)

    stmt = stmt.order_by(StockMoveORM.created_at.desc()).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


@router.post("/inventory/moves", response_model=StockMoveOut)
def create_stock_move(
    request: Request,
    body: StockMoveCreateIn,
    db: Session = Depends(get_db),
) -> StockMoveOut:
    store_id = _require_store_id(request, body.store_id)
    _assert_store_scope(store_id, _get_actor_store_id(request))

    item = db.get(InventoryItemORM, body.item_id)
    if not item or item.store_id != store_id:
        raise HTTPException(status_code=400, detail="Invalid item_id")

    now = _utcnow()

    qty = Decimal(str(body.qty))
    unit_cost = Decimal(str(body.unit_cost)) if body.unit_cost is not None else Decimal(str(item.cost_price or 0))

    # qty_on_hand 更新
    if body.move_type == "in":
        item.qty_on_hand = Decimal(str(item.qty_on_hand)) + qty
    elif body.move_type == "out":
        if Decimal(str(item.qty_on_hand)) < qty:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        item.qty_on_hand = Decimal(str(item.qty_on_hand)) - qty
    elif body.move_type == "adjust":
        # adjust は qty を「差分量」として扱う（+/- は許可しないので、運用上は in/out を推奨）
        # ここでは "adjust" の場合は in と同等に加算として扱う（必要なら別設計に）
        item.qty_on_hand = Decimal(str(item.qty_on_hand)) + qty
    else:
        raise HTTPException(status_code=400, detail="Invalid move_type")

    mv = StockMoveORM(
        id=uuid4(),
        store_id=store_id,
        item_id=item.id,
        move_type=body.move_type,
        qty=qty,
        unit_cost=unit_cost,
        ref_type=body.ref_type,
        ref_id=body.ref_id,
        note=body.note,
        created_at=now,
    )
    db.add(mv)

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"IntegrityError: {e}") from e

    db.refresh(mv)
    return mv