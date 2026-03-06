"""自賠責保険料・重量税 簡易計算サービス（2024年度法定料金）"""
from __future__ import annotations

from datetime import date
from typing import List, Optional


# ─── 自賠責保険料テーブル ─────────────────────────────────────────
# key: (vehicle_type, months)
JIBAISEKI_TABLE: dict[tuple[str, int], int] = {
    # 自家用乗用車
    ("passenger", 12): 11_280,
    ("passenger", 24): 17_650,
    ("passenger", 25): 18_530,
    ("passenger", 36): 24_950,
    ("passenger", 37): 25_830,
    # 軽自動車（自家用）
    ("kei", 12): 9_870,
    ("kei", 24): 15_520,
    ("kei", 25): 16_130,
    ("kei", 36): 22_010,
    ("kei", 37): 22_630,
    # 軽自動車（営業用）
    ("kei_business", 12): 10_180,
    ("kei_business", 24): 16_220,
    ("kei_business", 37): 23_660,
    # 小型二輪（250cc超）
    ("bike_small", 12): 8_760,
    ("bike_small", 24): 13_310,
    ("bike_small", 25): 13_970,
    ("bike_small", 36): 18_160,
    # 原付（125cc以下）
    ("moped", 12): 7_500,
    ("moped", 24): 10_590,
}

# ─── 重量税テーブル ───────────────────────────────────────────────
# 非エコカー / 車検2年 の0.5t刻み単価（tons → fee）
# key: (age_category, weight_tons_upper)
JYURYOZEI_TABLE: dict[tuple[str, float], int] = {
    # 13年未満
    ("under13", 0.5): 8_200,
    ("under13", 1.0): 16_400,
    ("under13", 1.5): 24_600,
    ("under13", 2.0): 32_800,
    ("under13", 2.5): 41_000,
    ("under13", 3.0): 49_200,
    # 13年以上18年未満
    ("13to18", 0.5): 11_400,
    ("13to18", 1.0): 22_800,
    ("13to18", 1.5): 34_200,
    ("13to18", 2.0): 45_600,
    ("13to18", 2.5): 57_000,
    ("13to18", 3.0): 68_400,
    # 18年以上
    ("over18", 0.5): 12_600,
    ("over18", 1.0): 25_200,
    ("over18", 1.5): 37_800,
    ("over18", 2.0): 50_400,
    ("over18", 2.5): 63_000,
    ("over18", 3.0): 75_600,
}

# 軽自動車重量税（車検2年）
KEI_JYURYOZEI: dict[str, int] = {
    "under13": 6_600,
    "13to18":  8_200,
    "over18":  8_800,
}

WEIGHT_THRESHOLDS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]

VEHICLE_TYPE_LABELS: dict[str, str] = {
    "passenger":    "自家用乗用車",
    "kei":          "軽自動車（自家用）",
    "kei_business": "軽自動車（営業用）",
    "bike_small":   "小型二輪（250cc超）",
    "moped":        "原付（125cc以下）",
}

ECO_TYPE_LABELS: dict[str, str] = {
    "non_eco": "非エコカー",
    "exempt":  "エコカー免税",
    "eco_75":  "エコカー75%減",
    "eco_50":  "エコカー50%減",
    "eco_25":  "エコカー25%減",
}

ECO_MULTIPLIERS: dict[str, float] = {
    "non_eco": 1.0,
    "exempt":  0.0,
    "eco_75":  0.25,
    "eco_50":  0.50,
    "eco_25":  0.75,
}


def _age_category(vehicle_age: int) -> str:
    if vehicle_age < 13:
        return "under13"
    if vehicle_age < 18:
        return "13to18"
    return "over18"


def calc_jibaiseki(vehicle_type: str, months: int) -> Optional[int]:
    return JIBAISEKI_TABLE.get((vehicle_type, months))


def calc_jyuryozei(
    vehicle_type: str,
    weight_kg: float,
    vehicle_age: int,
    eco_type: str,
    inspection_years: int,
) -> tuple[int, List[str]]:
    """重量税を計算して (fee, notes) を返す。"""
    notes: List[str] = []
    age_cat = _age_category(vehicle_age)
    multiplier = ECO_MULTIPLIERS.get(eco_type, 1.0)

    # 車検1年は2年の半額（端数切り捨て）
    year_factor = inspection_years / 2

    is_kei = vehicle_type in ("kei", "kei_business")

    if is_kei:
        base = KEI_JYURYOZEI.get(age_cat, 0)
        fee = int(base * multiplier * year_factor)
    else:
        weight_tons = weight_kg / 1000.0
        upper = next((t for t in WEIGHT_THRESHOLDS if weight_tons <= t), None)
        if upper is None:
            notes.append("車両重量が3t超のため計算対象外です。個別にご確認ください。")
            return 0, notes
        base = JYURYOZEI_TABLE.get((age_cat, upper), 0)
        fee = int(base * multiplier * year_factor)

    if eco_type == "exempt":
        notes.append("エコカー免税のため重量税は0円です。")
    elif eco_type != "non_eco":
        notes.append(f"エコカー減税（{ECO_TYPE_LABELS[eco_type]}）が適用されています。")

    if vehicle_age >= 18:
        notes.append("初年度登録から18年以上経過しているため重課税率が適用されています。")
    elif vehicle_age >= 13:
        notes.append("初年度登録から13年以上経過しているため重課税率が適用されています。")

    return fee, notes


def calculate(
    vehicle_type: str,
    weight_kg: float,
    first_reg_year: int,
    first_reg_month: int,
    eco_type: str,
    jibaiseki_months: int,
    inspection_years: int,
) -> dict:
    today = date.today()
    reg_date = date(first_reg_year, first_reg_month, 1)
    vehicle_age = (today.year - reg_date.year) + (
        0 if (today.month, today.day) >= (reg_date.month, 1) else -1
    )
    age_cat = _age_category(vehicle_age)

    jibaiseki = calc_jibaiseki(vehicle_type, jibaiseki_months)
    jyuryozei, notes = calc_jyuryozei(
        vehicle_type, weight_kg, vehicle_age, eco_type, inspection_years
    )

    if jibaiseki is None:
        jibaiseki = 0
        notes.append(
            f"車種「{VEHICLE_TYPE_LABELS.get(vehicle_type, vehicle_type)}」の"
            f"{jibaiseki_months}ヶ月自賠責料金テーブルが見つかりません。"
        )

    return {
        "jibaiseki": jibaiseki,
        "jyuryozei": jyuryozei,
        "total": jibaiseki + jyuryozei,
        "vehicle_age": vehicle_age,
        "age_category": age_cat,
        "notes": notes,
    }
