from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class CarValuationHistoryOut(BaseModel):
    """
    car_valuations テーブル（履歴）を返すためのレスポンススキーマ。
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    car_id: UUID

    expected_sell_price: int | None = Field(default=None, ge=0)
    expected_profit: int | None = None
    expected_profit_rate: float | None = None

    # 実カラムに合わせてどちらか/両方を採用
    created_at: datetime | None = None
    valuation_at: datetime | None = None
