from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.deps import get_current_user
from app.models.valuation_settings import ValuationSettings

router = APIRouter(prefix="/valuation", tags=["valuation"])


@router.post("/calculate")
def calculate_valuation(
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # --------------------------------------------------
    # 1. 相場（仮） ← 後で外部APIに置き換える
    # --------------------------------------------------

    market_median = 1000000
    market_low = int(market_median * 0.9)
    market_high = int(market_median * 1.1)

    # --------------------------------------------------
    # 2. 店舗設定取得
    # --------------------------------------------------

    settings = (
        db.query(ValuationSettings)
        .filter(ValuationSettings.store_id == current_user.store_id)
        .first()
    )

    if not settings:
        buy_cap_pct = 0.92
        risk_buffer = 30000
    else:
        buy_cap_pct = float(settings.buy_cap_pct)
        risk_buffer = settings.risk_buffer_yen

    # --------------------------------------------------
    # 3. 買取上限
    # --------------------------------------------------

    buy_cap_price = int(market_median * buy_cap_pct) - risk_buffer

    # --------------------------------------------------
    # 4. 推奨販売価格
    # --------------------------------------------------

    recommended_price = market_median

    # --------------------------------------------------
    # 5. 利益
    # --------------------------------------------------

    expected_profit = recommended_price - buy_cap_price
    expected_profit_rate = expected_profit / recommended_price

    # --------------------------------------------------
    # 6. 結果返却
    # --------------------------------------------------

    return {
        "market_low": market_low,
        "market_median": market_median,
        "market_high": market_high,
        "buy_cap_price": buy_cap_price,
        "recommended_price": recommended_price,
        "expected_profit": expected_profit,
        "expected_profit_rate": expected_profit_rate,
    }
