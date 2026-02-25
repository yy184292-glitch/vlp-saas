from __future__ import annotations

from typing import Generic, List, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")

class PageMeta(BaseModel):
    limit: int = Field(ge=1, le=200)
    offset: int = Field(ge=0)
    total: int = Field(ge=0)

class Page(BaseModel, Generic[T]):
    items: List[T]
    meta: PageMeta
