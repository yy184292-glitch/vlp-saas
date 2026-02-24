from sqlalchemy.orm import Session

from app.models.valuation_settings import ValuationSettings


def calculate_valuation(
    db: Session,
    store_id,
    make: str,
    model: str,
    grade: str,
    year: int,
    mileage: int,
):

    # 仮相場（後で external provider に置き換え）
    market_median = 1_000_000
    market_low = int(market_median * 0.9)
    market_high = int(market_median * 1.1)

    settings = (
        db.query(ValuationSettings)
        .filter(ValuationSettings.store_id == store_id)
        .first()
    )

    buy_cap_pct = float(settings.buy_cap_pct) if settings else 0.92
    risk_buffer = settings.risk_buffer_yen if settings else 30000

    buy_cap_price = int(market_median * buy_cap_pct) - risk_buffer

    recommended_price = market_median

    expected_profit = recommended_price - buy_cap_price

    expected_profit_rate = expected_profit / recommended_price

    return {
        "market_low": market_low,
        "market_median": market_median,
        "market_high": market_high,
        "buy_cap_price": buy_cap_price,
        "recommended_price": recommended_price,
        "expected_profit": expected_profit,
        "expected_profit_rate": expected_profit_rate,
    }
