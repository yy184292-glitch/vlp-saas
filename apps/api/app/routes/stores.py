from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.store import StoreORM
from app.schemas.store import StoreCreateIn, StoreOut, StoreUpdateIn

router = APIRouter(tags=["stores"])


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


@router.get("/stores", response_model=List[StoreOut])
def list_stores(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[StoreOut]:
    """
    注意:
    - 本来は「自分の store_id のみ返す」でも良い。
    - ただし現状 request.state.user が無いケースもあるので、
      store_id が取れない場合は全件返す（開発用）。
    """
    stmt = select(StoreORM).order_by(StoreORM.created_at.desc()).limit(limit).offset(offset)

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None:
        stmt = stmt.where(StoreORM.id == actor_store_id)

    return db.execute(stmt).scalars().all()


@router.get("/stores/{store_id}", response_model=StoreOut)
def get_store(
    request: Request,
    store_id: UUID,
    db: Session = Depends(get_db),
) -> StoreOut:
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    return row


@router.post("/stores", response_model=StoreOut)
def create_store(
    body: StoreCreateIn,
    db: Session = Depends(get_db),
) -> StoreOut:
    now = _utcnow()
    row = StoreORM(
        id=uuid4(),
        name=body.name,
        postal_code=body.postal_code,
        address1=body.address1,
        address2=body.address2,
        tel=body.tel,
        email=body.email,
        invoice_number=body.invoice_number,
        bank_name=body.bank_name,
        bank_branch=body.bank_branch,
        bank_account_type=body.bank_account_type,
        bank_account_number=body.bank_account_number,
        bank_account_holder=body.bank_account_holder,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/stores/{store_id}", response_model=StoreOut)
def update_store(
    request: Request,
    store_id: UUID,
    body: StoreUpdateIn,
    db: Session = Depends(get_db),
) -> StoreOut:
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    # 部分更新
    for k, v in body.dict(exclude_unset=True).items():
        setattr(row, k, v)

    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row