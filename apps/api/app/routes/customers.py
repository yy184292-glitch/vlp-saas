from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.customer import CustomerORM

router = APIRouter(tags=["customers"])


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


def _resolve_store_id(request: Request, body_store_id: Optional[UUID]) -> UUID:
    actor_store_id = _get_actor_store_id(request)
    store_id = actor_store_id or body_store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    # tokenにstore_idがあるならスコープ固定（他店IDを指定しても見えないように）
    if actor_store_id and store_id != actor_store_id:
        raise HTTPException(status_code=404, detail="Not found")
    return store_id


def _assert_scope(request: Request, customer: CustomerORM) -> None:
    actor_store_id = _get_actor_store_id(request)
    if actor_store_id and customer.store_id != actor_store_id:
        raise HTTPException(status_code=404, detail="Not found")


# ============================================================
# schemas
# ============================================================

class CustomerCreateIn(BaseModel):
    store_id: Optional[UUID] = None

    name: str = Field(..., max_length=255)
    name_kana: Optional[str] = Field(default=None, max_length=255)
    honorific: Optional[str] = Field(default=None, max_length=16)

    postal_code: Optional[str] = Field(default=None, max_length=16)
    address1: Optional[str] = Field(default=None, max_length=255)
    address2: Optional[str] = Field(default=None, max_length=255)

    tel: Optional[str] = Field(default=None, max_length=32)
    email: Optional[str] = Field(default=None, max_length=255)
    contact_person: Optional[str] = Field(default=None, max_length=255)

    invoice_number: Optional[str] = Field(default=None, max_length=32)
    payment_terms: Optional[str] = Field(default=None, max_length=255)


class CustomerUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    name_kana: Optional[str] = Field(default=None, max_length=255)
    honorific: Optional[str] = Field(default=None, max_length=16)

    postal_code: Optional[str] = Field(default=None, max_length=16)
    address1: Optional[str] = Field(default=None, max_length=255)
    address2: Optional[str] = Field(default=None, max_length=255)

    tel: Optional[str] = Field(default=None, max_length=32)
    email: Optional[str] = Field(default=None, max_length=255)
    contact_person: Optional[str] = Field(default=None, max_length=255)

    invoice_number: Optional[str] = Field(default=None, max_length=32)
    payment_terms: Optional[str] = Field(default=None, max_length=255)


class CustomerOut(BaseModel):
    id: UUID
    store_id: UUID

    name: str
    name_kana: Optional[str]
    honorific: str

    postal_code: Optional[str]
    address1: Optional[str]
    address2: Optional[str]

    tel: Optional[str]
    email: Optional[str]
    contact_person: Optional[str]

    invoice_number: Optional[str]
    payment_terms: Optional[str]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# list
# ============================================================

@router.get("/customers", response_model=List[CustomerOut])
def list_customers(
    request: Request,
    db: Session = Depends(get_db),
):
    actor_store_id = _get_actor_store_id(request)

    stmt = select(CustomerORM)
    if actor_store_id:
        stmt = stmt.where(CustomerORM.store_id == actor_store_id)

    stmt = stmt.order_by(CustomerORM.created_at.desc())
    return db.execute(stmt).scalars().all()


# ============================================================
# get
# ============================================================

@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(
    request: Request,
    customer_id: UUID,
    db: Session = Depends(get_db),
):
    customer = db.get(CustomerORM, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    _assert_scope(request, customer)
    return customer


# ============================================================
# create
# ============================================================

@router.post("/customers", response_model=CustomerOut)
def create_customer(
    request: Request,
    body: CustomerCreateIn,
    db: Session = Depends(get_db),
):
    now = _utcnow()
    store_id = _resolve_store_id(request, body.store_id)

    customer = CustomerORM(
        id=uuid4(),
        store_id=store_id,
        name=body.name,
        name_kana=body.name_kana,
        honorific=(body.honorific or "御中"),
        postal_code=body.postal_code,
        address1=body.address1,
        address2=body.address2,
        tel=body.tel,
        email=body.email,
        contact_person=body.contact_person,
        invoice_number=body.invoice_number,
        payment_terms=body.payment_terms,
        created_at=now,
        updated_at=now,
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# ============================================================
# update
# ============================================================

@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(
    request: Request,
    customer_id: UUID,
    body: CustomerUpdateIn,
    db: Session = Depends(get_db),
):
    now = _utcnow()

    customer = db.get(CustomerORM, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    _assert_scope(request, customer)

    if body.name is not None:
        customer.name = body.name
    if body.name_kana is not None:
        customer.name_kana = body.name_kana
    if body.honorific is not None:
        customer.honorific = body.honorific

    if body.postal_code is not None:
        customer.postal_code = body.postal_code
    if body.address1 is not None:
        customer.address1 = body.address1
    if body.address2 is not None:
        customer.address2 = body.address2

    if body.tel is not None:
        customer.tel = body.tel
    if body.email is not None:
        customer.email = body.email
    if body.contact_person is not None:
        customer.contact_person = body.contact_person

    if body.invoice_number is not None:
        customer.invoice_number = body.invoice_number
    if body.payment_terms is not None:
        customer.payment_terms = body.payment_terms

    customer.updated_at = now

    db.commit()
    db.refresh(customer)
    return customer


# ============================================================
# delete
# ============================================================

@router.delete("/customers/{customer_id}")
def delete_customer(
    request: Request,
    customer_id: UUID,
    db: Session = Depends(get_db),
):
    customer = db.get(CustomerORM, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    _assert_scope(request, customer)

    db.delete(customer)
    db.commit()
    return {"deleted": True}