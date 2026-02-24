# app/schemas/car.py

from datetime import date, datetime
from pydantic import BaseModel, Field, AliasChoices


class CarBase(BaseModel):

    stock_no: str
    car_number: str | None = None
    status: str = "在庫"

    # ★ここがポイント：入力は make / maker どっちでもOK、内部は make に統一
    make: str | None = Field(
        default=None,
        validation_alias=AliasChoices("make", "maker"),
        serialization_alias="maker",  # レスポンスは今まで通り maker で返したいなら
    )

    model: str | None = None
    model_code: str | None = None
    grade: str | None = None

    year: int | None = None
    year_month: str | None = None

    mileage: int | None = None
    color: str | None = None

    vin: str | None = None
    accident_history: str | None = None

    purchase_price: int | None = None
    expected_sell_price: int | None = None
    actual_sell_price: int | None = None

    purchase_date: date | None = None
    sell_date: date | None = None

    location: str | None = None
    memo: str | None = None

    inspection_expiry: date | None = None
    insurance_expiry: date | None = None


class CarCreate(CarBase):
    pass


class CarUpdate(BaseModel):
    stock_no: str | None = None
    car_number: str | None = None
    status: str | None = None

    # updateも同様に
    make: str | None = Field(default=None, validation_alias=AliasChoices("make", "maker"))

    model: str | None = None
    model_code: str | None = None
    grade: str | None = None
    year: int | None = None
    year_month: str | None = None
    mileage: int | None = None
    color: str | None = None
    vin: str | None = None
    accident_history: str | None = None
    purchase_price: int | None = None
    expected_sell_price: int | None = None
    actual_sell_price: int | None = None
    purchase_date: date | None = None
    sell_date: date | None = None
    location: str | None = None
    memo: str | None = None
    inspection_expiry: date | None = None
    insurance_expiry: date | None = None


class CarRead(CarBase):

    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
