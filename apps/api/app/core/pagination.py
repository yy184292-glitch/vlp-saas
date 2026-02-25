from __future__ import annotations

from fastapi import Query

LimitQuery = Query(20, ge=1, le=200, description="Number of items to return (max 200)")
OffsetQuery = Query(0, ge=0, description="Number of items to skip before starting to collect the result set")
