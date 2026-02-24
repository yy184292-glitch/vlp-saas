from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# ===== あなたのプロジェクト構成に合わせて import パスを調整してください =====
from app.db.session import get_db
from app.models.car import Car
from app.models.user import User
from app.services.valuation_service import calculate_valuation  # あなたが貼った calculate_valuation が入ってるモジュール

logger = logging.getLogger(__name__)
router = APIRouter()


def _require_int(v: Any, field: str) -> int:
    """
    DB上でNULL許容でも、査定計算は数値必須の項目を安全にバリデーションする。
    """
    if v is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Car.{field} is required for valuation",
        )
    try:
        return int(v)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Car.{field} must be an integer",
        )


@router.post(
    "/cars/{car_id}/valuation",
    summary="Calculate valuation and save to car",
)
def save_valuation_to_car(
    car_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    査定を計算して cars に保存する。
    保存先（想定）:
      - expected_buy_price
      - expected_sell_price
      - expected_profit
      - expected_profit_rate
      - valuation_at
    """
    try:
        # 1) 対象車両を store_id で必ず絞る（テナント分離）
        car: Car | None = (
            db.query(Car)
            .filter(
                Car.id == car_id,
                Car.store_id == current_user.store_id,
            )
            .first()
        )
        if not car:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Car not found")

        # 2) 査定計算に必要な入力を確定（NULLなら400）
        # maker/model のフィールド名はあなたのDB定義に合わせて（例: maker or make / model など）
        make = (getattr(car, "maker", None) or getattr(car, "make", None) or "").strip()
        model = (getattr(car, "model", None) or "").strip()

        if not make:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Car.maker (or make) is required for valuation",
            )
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Car.model is required for valuation",
            )

        grade = (getattr(car, "grade", None) or "").strip()
        year = _require_int(getattr(car, "year", None), "year")
        mileage = _require_int(getattr(car, "mileage", None), "mileage")

        # 3) 重要：calculate_valuation は current_user を受け取らず store_id を受け取る
        valuation = calculate_valuation(
            db=db,
            store_id=current_user.store_id,
            make=make,
            model=model,
            grade=grade,
            year=year,
            mileage=mileage,
        )

        # 4) cars へ保存（キー名は calculate_valuation の戻りに合わせる）
        # calculate_valuation の戻り:
        #   buy_cap_price, recommended_price, expected_profit, expected_profit_rate ... :contentReference[oaicite:2]{index=2}
        car.expected_buy_price = int(valuation["buy_cap_price"])
        car.expected_sell_price = int(valuation["recommended_price"])
        car.expected_profit = int(valuation["expected_profit"])
        car.expected_profit_rate = float(valuation["expected_profit_rate"])
        car.valuation_at = datetime.now(timezone.utc)

        db.add(car)
        db.commit()
        db.refresh(car)

        # 5) レスポンス（フロントが使いやすい形に）
        return {
            "car_id": str(car.id),
            "saved": True,
            "valuation_at": car.valuation_at.isoformat() if car.valuation_at else None,
            "valuation": valuation,
        }

    except HTTPException:
        # 期待通りのエラーはそのまま返す
        raise
    except Exception as e:
        # 予期せぬエラーはロールバックして500
        logger.exception("save_valuation_to_car failed")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"save_valuation_to_car failed: {type(e).__name__}: {str(e)}",
        ) from None
