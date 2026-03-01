from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StoreBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    postal_code: Optional[str] = Field(default=None, max_length=16)
    address1: Optional[str] = Field(default=None, max_length=255)
    address2: Optional[str] = Field(default=None, max_length=255)
    tel: Optional[str] = Field(default=None, max_length=32)
    email: Optional[str] = Field(default=None, max_length=255)

    invoice_number: Optional[str] = Field(default=None, max_length=32)

    bank_name: Optional[str] = Field(default=None, max_length=64)
    bank_branch: Optional[str] = Field(default=None, max_length=64)
    bank_account_type: Optional[str] = Field(default=None, max_length=16)
    bank_account_number: Optional[str] = Field(default=None, max_length=32)
    bank_account_holder: Optional[str] = Field(default=None, max_length=128)


class StoreCreateIn(StoreBase):
    pass


class StoreUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)

    postal_code: Optional[str] = Field(default=None, max_length=16)
    address1: Optional[str] = Field(default=None, max_length=255)
    address2: Optional[str] = Field(default=None, max_length=255)
    tel: Optional[str] = Field(default=None, max_length=32)
    email: Optional[str] = Field(default=None, max_length=255)

    invoice_number: Optional[str] = Field(default=None, max_length=32)

    bank_name: Optional[str] = Field(default=None, max_length=64)
    bank_branch: Optional[str] = Field(default=None, max_length=64)
    bank_account_type: Optional[str] = Field(default=None, max_length=16)
    bank_account_number: Optional[str] = Field(default=None, max_length=32)
    bank_account_holder: Optional[str] = Field(default=None, max_length=128)


class StoreOut(StoreBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True