# apps/api/app/routes/cars.py
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user  # ✅ “唯一の正”を使う
from app.models.car import Car
from app.models.car_valuation import CarValuation
from app.models.user import User
from app.schemas.car import CarCreate, CarRead, CarUpdate
from app.services.valuation_service import calculate_valuation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cars", tags=["cars"])


# =========================================================
# Response models (pagination + valuation history)
#   ※ 追加ファイル無しで動くように routes 側に定義
# =========================================================
class PageMeta(BaseModel):
    limit: int = Field(default=20, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    total: int = Field(ge=0)


class CarsListResponse(BaseModel):
    items: List[CarRead]
    meta: PageMeta


class CarValuationRead(BaseModel):
    """
    car_valuations（履歴）返却用。
    CarValuation モデルに合わせてフィールドを定義。
    """
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    car_id: UUID
    store_id: UUID

    buy_price: int
    sell_price: int
    profit: int
    profit_rate: float

    valuation_at: datetime
    created_at: datetime


class CarValuationsListResponse(BaseModel):
    items: List[CarValuationRead]
    meta: PageMeta


# =========================================================
# Internal helpers
# =========================================================
def _to_int(value: Any, *, default: int = 0) -> int:
    """Best-effort int coercion for API/DB safety."""
    if value is None:
        return default
    try:
        if isinstance(value, bool):
            return default
        if isinstance(value, (int,)):
            return int(value)
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return default
            return int(float(s))
        return int(value)
    except Exception:
        return default


def _to_float(value: Any, *, default: float = 0.0) -> float:
    """Best-effort float coercion for API/DB safety."""
    if value is None:
        return default
    try:
        if isinstance(value, bool):
            return default
        if isinstance(value, (float, int)):
            return float(value)
        if isinstance(value, str):
            s = value.strip()
            if not s:
                return default
            return float(s)
        return float(value)
    except Exception:
        return default


def _norm_str(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s if s else None
    return value


def _create_car_with_payload(db: Session, current_user: User, payload: Dict[str, Any]) -> Car:
    """
    CarCreate の payload を受け取り、DBモデルに合わせて整形して作成する。
    store_id / user_id は必ずサーバ側で付与する（テナント分離）。
    """
    payload = dict(payload)

    # サーバ管理項目は無視
    payload.pop("id", None)
    payload.pop("created_at", None)
    payload.pop("updated_at", None)

    # ✅ テナント分離を強制
    payload["user_id"] = current_user.id
    payload["store_id"] = current_user.store_id

    # 値正規化
    for k in list(payload.keys()):
        payload[k] = _norm_str(payload[k])

    # make/maker 揺れ吸収（DB要件に合わせる）
    if not payload.get("make"):
        payload["make"] = payload.get("maker")
    if not payload.get("maker"):
        payload["maker"] = payload.get("make")

    # モデルのカラムのみ許可（余計なキーは落とす）
    mapper = inspect(Car)
    allowed_keys = {c.key for c in mapper.columns}
    payload = {k: v for k, v in payload.items() if k in allowed_keys}

    # 最低限チェック
    required = ["stock_no", "make", "model", "year"]
    missing = [k for k in required if payload.get(k) in (None, "")]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required fields: {missing}",
        )

    # year / mileage が文字で来る可能性があるので軽く安全に寄せる
    if "year" in payload:
        payload["year"] = _to_int(payload["year"], default=0) or None
    if "mileage" in payload:
        payload["mileage"] = _to_int(payload["mileage"], default=0)

    try:
        car = Car(**payload)
        db.add(car)
        db.commit()
        db.refresh(car)
        return car
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Integrity error: {str(getattr(e, 'orig', e))}",
        ) from None
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create car")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create car: {type(e).__name__}: {str(e)}",
        ) from None


def _get_car_owned(db: Session, car_id: UUID, current_user: User) -> Car:
    """Fetch car and enforce tenant ownership."""
    car: Optional[Car] = db.get(Car, car_id)
    if car is None:
        raise HTTPException(status_code=404, detail="Car not found")
    if getattr(car, "store_id", None) != current_user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return car


def _clamp_limit_offset(limit: int, offset: int) -> tuple[int, int]:
    # FastAPI側でバリデーションしても、念のため二重化
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))
    return limit, offset


# =========================================================
# LIST (NEW): GET /cars
# =========================================================
@router.get("", response_model=CarsListResponse)
def list_cars(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    在庫一覧取得（store完全分離）
    並び順：
      1. valuation_at DESC（最新査定）
      2. updated_at DESC
      3. created_at DESC
    """

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    # total count
    total = db.execute(
        select(func.count()).select_from(Car).where(
            Car.store_id == current_user.store_id
        )
    ).scalar_one()

    # items fetch
    items = db.execute(
        select(Car).where(
            Car.store_id == current_user.store_id
        ).order_by(
            desc(Car.valuation_at),
            desc(Car.updated_at),
            desc(Car.created_at),
        ).limit(limit).offset(offset)
    ).scalars().all()

    return CarsListResponse(
        items=items,
        meta=PageMeta(
            limit=limit,
            offset=offset,
            total=total,
        ),
    )

# =========================================================
# CRUD
# =========================================================
@router.post("", response_model=CarRead, status_code=status.HTTP_201_CREATED)
def create_car(
    data: CarCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    return _create_car_with_payload(db, current_user, payload)


@router.put("/{car_id}", response_model=CarRead)
def update_car(
    car_id: UUID,
    data: CarUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = _get_car_owned(db, car_id, current_user)

    # ✅ テナント関連の更新は拒否（万一 schema に混入しても守る）
    blocked_fields = {"id", "user_id", "store_id", "created_at", "updated_at"}
    updates = data.model_dump(exclude_unset=True)

    for key, value in updates.items():
        if key in blocked_fields:
            continue
        setattr(car, key, value)

    try:
        db.commit()
        db.refresh(car)
        return car
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Integrity error: {str(getattr(e, 'orig', e))}",
        ) from None
    except Exception as e:
        db.rollback()
        logger.exception("update_car failed")
        raise HTTPException(
            status_code=500,
            detail=f"update_car failed: {type(e).__name__}: {str(e)}",
        ) from None


@router.delete("/{car_id}")
def delete_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    car = _get_car_owned(db, car_id, current_user)

    try:
        db.delete(car)
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        logger.exception("delete_car failed")
        raise HTTPException(
            status_code=500,
            detail=f"delete_car failed: {type(e).__name__}: {str(e)}",
        ) from None


# =========================================================
# Valuation Save
# =========================================================
@router.post("/{car_id}/valuation", response_model=CarRead)
def save_valuation_to_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    査定を計算して
    - cars を更新
    - car_valuations に履歴を保存
    を同一トランザクションで実行
    """
    car = _get_car_owned(db, car_id, current_user)

    make = getattr(car, "make", None) or getattr(car, "maker", None)
    model = getattr(car, "model", None)
    year = getattr(car, "year", None)

    if not make or not model or not year:
        raise HTTPException(
            status_code=400,
            detail="Car is missing required fields for valuation.",
        )

    try:
        result = calculate_valuation(
            db=db,
            store_id=current_user.store_id,
            make=str(make),
            model=str(model),
            grade=str(getattr(car, "grade", "") or ""),
            year=int(year),
            mileage=int(getattr(car, "mileage", 0) or 0),
        )

        now = datetime.now(timezone.utc)

        buy_price = int(result["buy_cap_price"])
        sell_price = int(result["recommended_price"])
        profit = int(result["expected_profit"])
        profit_rate = float(result["expected_profit_rate"])

        # ----------------------------
        # cars 更新（最新状態）
        # ----------------------------
        car.expected_buy_price = buy_price
        car.expected_sell_price = sell_price
        car.expected_profit = profit
        car.expected_profit_rate = profit_rate
        car.valuation_at = now

        db.add(car)

        # ----------------------------
        # 履歴追加
        # ----------------------------
        history = CarValuation(
            car_id=car.id,
            store_id=current_user.store_id,
            buy_price=buy_price,
            sell_price=sell_price,
            profit=profit,
            profit_rate=profit_rate,
            valuation_at=now,
        )

        db.add(history)

        # ----------------------------
        # commit（同時）
        # ----------------------------
        db.commit()
        db.refresh(car)

        return car

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("save_valuation_to_car failed")
        raise HTTPException(
            status_code=500,
            detail=f"save_valuation_to_car failed: {type(e).__name__}: {str(e)}",
        ) from None


# =========================================================
# Valuation History (NEW): GET /cars/{car_id}/valuations
# =========================================================
@router.get("/{car_id}/valuations", response_model=CarValuationsListResponse)
def list_car_valuations(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    """
    査定履歴一覧（テナント分離: store_id）。
    pagination: limit/offset
    """
    limit, offset = _clamp_limit_offset(limit, offset)

    # 車が自分のstoreのものか確認（403/404）
    _ = _get_car_owned(db, car_id, current_user)

    try:
        total_stmt = (
            select(func.count())
            .select_from(CarValuation)
            .where(
                CarValuation.car_id == car_id,
                CarValuation.store_id == current_user.store_id,
            )
        )
        total = db.execute(total_stmt).scalar_one()

        items_stmt = (
            select(CarValuation)
            .where(
                CarValuation.car_id == car_id,
                CarValuation.store_id == current_user.store_id,
            )
            .order_by(desc(CarValuation.valuation_at), desc(CarValuation.id))
            .limit(limit)
            .offset(offset)
        )
        items = db.execute(items_stmt).scalars().all()

        return CarValuationsListResponse(
            items=items,
            meta=PageMeta(limit=limit, offset=offset, total=total),
        )
    except Exception as e:
        logger.exception("list_car_valuations failed")
        raise HTTPException(
            status_code=500,
            detail=f"list_car_valuations failed: {type(e).__name__}: {str(e)}",
        ) from None


from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, func, select


class PageMeta(BaseModel):
    limit: int
    offset: int
    total: int


class CarValuationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    car_id: UUID
    store_id: UUID
    buy_price: int
    sell_price: int
    profit: int
    profit_rate: float
    valuation_at: datetime
    created_at: datetime


class CarValuationsListResponse(BaseModel):
    items: list[CarValuationRead]
    meta: PageMeta


@router.get("/{car_id}/valuations", response_model=CarValuationsListResponse)
def list_car_valuations(
    car_id: UUID,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    car = db.get(Car, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if car.store_id != current_user.store_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    total = db.execute(
        select(func.count()).select_from(CarValuation).where(
            CarValuation.car_id == car_id,
            CarValuation.store_id == current_user.store_id,
        )
    ).scalar_one()

    items = db.execute(
        select(CarValuation).where(
            CarValuation.car_id == car_id,
            CarValuation.store_id == current_user.store_id,
        ).order_by(
            desc(CarValuation.valuation_at),
            desc(CarValuation.created_at),
        ).limit(limit).offset(offset)
    ).scalars().all()

    return CarValuationsListResponse(
        items=items,
        meta=PageMeta(limit=limit, offset=offset, total=total),
    )


from sqlalchemy import select, func, desc

class CarsListResponse(BaseModel):
    items: list[CarRead]
    meta: PageMeta


@router.get("", response_model=CarsListResponse)
def list_cars(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    total = db.execute(
        select(func.count()).select_from(Car).where(
            Car.store_id == current_user.store_id
        )
    ).scalar_one()

    items = db.execute(
        select(Car).where(
            Car.store_id == current_user.store_id
        ).order_by(
            # valuation_at があるなら「最新査定順」
            desc(Car.valuation_at),
            desc(Car.id),
        ).limit(limit).offset(offset)
    ).scalars().all()

    return CarsListResponse(
        items=items,
        meta=PageMeta(limit=limit, offset=offset, total=total),
    )
