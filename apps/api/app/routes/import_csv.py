"""
CSV インポート API
- GET  /import/template/cars      → 車両テンプレート CSV ダウンロード
- GET  /import/template/customers → 顧客テンプレート CSV ダウンロード
- POST /import/cars?dry_run=true  → プレビュー（DB 書き込みなし）
- POST /import/cars               → 実インポート
- POST /import/customers?dry_run=true
- POST /import/customers
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.car import Car
from app.models.customer import CustomerORM

router = APIRouter(prefix="/import", tags=["import"])


# ── Utils ─────────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_store_id(request: Request) -> Optional[UUID]:
    user = getattr(request.state, "user", None)
    sid = getattr(user, "store_id", None)
    if isinstance(sid, UUID):
        return sid
    if isinstance(sid, str):
        try:
            return UUID(sid)
        except Exception:
            return None
    return None


def _get_user_id(request: Request) -> Optional[UUID]:
    user = getattr(request.state, "user", None)
    uid = getattr(user, "id", None)
    if isinstance(uid, UUID):
        return uid
    if isinstance(uid, str):
        try:
            return UUID(uid)
        except Exception:
            return None
    return None


def _decode(content: bytes) -> str:
    """UTF-8 BOM → UTF-8 → Shift-JIS → cp932 の順で試みる"""
    for enc in ("utf-8-sig", "utf-8", "shift_jis", "cp932"):
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")


def _parse(text: str) -> List[Dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text))
    return [dict(r) for r in reader]


def _s(v: Any) -> str:
    return str(v or "").strip()


def _int_or_none(v: Any) -> Optional[int]:
    s = re.sub(r"[^\d\-]", "", _s(v))
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


# ── Templates ─────────────────────────────────────────────────────────────────

CAR_HEADERS = [
    "管理番号", "メーカー", "車種", "グレード", "年式", "走行距離(km)",
    "車体番号(VIN)", "型式", "カラー", "買取価格", "販売価格",
    "現所有者名", "現所有者フリガナ", "現所有者郵便番号",
    "現所有者住所1", "現所有者住所2", "現所有者電話番号",
]
CAR_EXAMPLE = [
    "S001", "トヨタ", "プリウス", "Z", "2022", "10000",
    "ABC1234567890", "ZVW51", "パールホワイト", "1500000", "2000000",
    "山田太郎", "ヤマダタロウ", "123-4567", "東京都渋谷区1-1", "", "03-1234-5678",
]

CUSTOMER_HEADERS = [
    "顧客名", "フリガナ", "敬称", "郵便番号", "住所1", "住所2",
    "電話番号", "メールアドレス", "担当者名", "支払条件",
]
CUSTOMER_EXAMPLE = [
    "株式会社サンプル", "カブシキガイシャサンプル", "御中",
    "123-4567", "東京都渋谷区1-1", "ビル3F",
    "03-1234-5678", "info@example.com", "鈴木一郎", "月末払い",
]


def _make_csv_response(headers: List[str], example: List[str], filename: str) -> Response:
    bom = "\ufeff"
    body = bom + ",".join(headers) + "\n" + ",".join(example) + "\n"
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.get("/template/cars")
def download_car_template() -> Response:
    return _make_csv_response(CAR_HEADERS, CAR_EXAMPLE, "car_import_template.csv")


@router.get("/template/customers")
def download_customer_template() -> Response:
    return _make_csv_response(CUSTOMER_HEADERS, CUSTOMER_EXAMPLE, "customer_import_template.csv")


# ── Response models ───────────────────────────────────────────────────────────

class ImportRowResult(BaseModel):
    row: int
    status: str          # "ok" | "error"
    reason: Optional[str] = None
    data: Dict[str, Any]


class ImportResult(BaseModel):
    total: int
    valid: int
    errors: int
    imported: int        # 0 の場合は dry_run
    rows: List[ImportRowResult]


# ── Car validation & import ───────────────────────────────────────────────────

def _validate_car(
    idx: int,
    row: Dict[str, str],
    seen_vins: set,
    db_vins: set,
) -> ImportRowResult:
    d = {
        "管理番号":        _s(row.get("管理番号")),
        "メーカー":        _s(row.get("メーカー")),
        "車種":            _s(row.get("車種")),
        "グレード":        _s(row.get("グレード")),
        "年式":            _s(row.get("年式")),
        "走行距離":        _s(row.get("走行距離(km)")),
        "VIN":             _s(row.get("車体番号(VIN)")),
        "型式":            _s(row.get("型式")),
        "カラー":          _s(row.get("カラー")),
        "買取価格":        _s(row.get("買取価格")),
        "販売価格":        _s(row.get("販売価格")),
        "現所有者名":      _s(row.get("現所有者名")),
        "現所有者フリガナ": _s(row.get("現所有者フリガナ")),
        "現所有者郵便番号": _s(row.get("現所有者郵便番号")),
        "現所有者住所1":   _s(row.get("現所有者住所1")),
        "現所有者住所2":   _s(row.get("現所有者住所2")),
        "現所有者電話番号": _s(row.get("現所有者電話番号")),
    }

    errs: List[str] = []
    if not d["管理番号"]:
        errs.append("管理番号は必須です")
    if not d["メーカー"]:
        errs.append("メーカーは必須です")
    if not d["車種"]:
        errs.append("車種は必須です")

    vin = d["VIN"]
    if vin:
        if vin in seen_vins:
            errs.append(f"車体番号 {vin} がCSV内で重複")
        elif vin in db_vins:
            errs.append(f"車体番号 {vin} はすでに登録済み")
        else:
            seen_vins.add(vin)

    if errs:
        return ImportRowResult(row=idx, status="error", reason=" / ".join(errs), data=d)
    return ImportRowResult(row=idx, status="ok", data=d)


@router.post("/cars", response_model=ImportResult)
async def import_cars(
    request: Request,
    file: UploadFile = File(...),
    dry_run: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> ImportResult:
    store_id = _get_store_id(request)
    user_id = _get_user_id(request)
    if not store_id or not user_id:
        raise HTTPException(status_code=401, detail="認証が必要です")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ファイルは5MB以下にしてください")

    rows = _parse(_decode(content))
    if not rows:
        return ImportResult(total=0, valid=0, errors=0, imported=0, rows=[])

    # DB 上の既存 VIN を取得
    db_vins: set = {
        v for v in db.execute(
            select(Car.vin).where(Car.store_id == store_id, Car.vin.isnot(None))
        ).scalars().all()
        if v
    }

    seen_vins: set = set()
    results: List[ImportRowResult] = []
    for idx, row in enumerate(rows, start=2):
        results.append(_validate_car(idx, row, seen_vins, db_vins))

    valid = [r for r in results if r.status == "ok"]
    imported = 0

    if not dry_run and valid:
        now = _utcnow()
        for r in valid:
            d = r.data
            db.add(Car(
                id=uuid4(),
                store_id=store_id,
                user_id=user_id,
                stock_no=d["管理番号"],
                status="在庫",
                make=d["メーカー"],
                maker=d["メーカー"],
                model=d["車種"],
                grade=d["グレード"] or None,
                year=_int_or_none(d["年式"]),
                mileage=_int_or_none(d["走行距離"]),
                vin=d["VIN"] or None,
                model_code=d["型式"] or None,
                color=d["カラー"] or None,
                expected_buy_price=_int_or_none(d["買取価格"]),
                expected_sell_price=_int_or_none(d["販売価格"]),
                owner_name=d["現所有者名"] or None,
                owner_name_kana=d["現所有者フリガナ"] or None,
                owner_postal_code=d["現所有者郵便番号"] or None,
                owner_address1=d["現所有者住所1"] or None,
                owner_address2=d["現所有者住所2"] or None,
                owner_tel=d["現所有者電話番号"] or None,
                created_at=now,
                updated_at=now,
            ))
        db.commit()
        imported = len(valid)

    return ImportResult(
        total=len(rows),
        valid=len(valid),
        errors=len(results) - len(valid),
        imported=imported,
        rows=results,
    )


# ── Customer validation & import ──────────────────────────────────────────────

def _validate_customer(
    idx: int,
    row: Dict[str, str],
    seen_tels: set,
    db_tels: set,
) -> ImportRowResult:
    d = {
        "顧客名":   _s(row.get("顧客名")),
        "フリガナ": _s(row.get("フリガナ")),
        "敬称":     _s(row.get("敬称")),
        "郵便番号": _s(row.get("郵便番号")),
        "住所1":    _s(row.get("住所1")),
        "住所2":    _s(row.get("住所2")),
        "電話番号": _s(row.get("電話番号")),
        "メール":   _s(row.get("メールアドレス")),
        "担当者名": _s(row.get("担当者名")),
        "支払条件": _s(row.get("支払条件")),
    }

    errs: List[str] = []
    if not d["顧客名"]:
        errs.append("顧客名は必須です")

    tel = d["電話番号"]
    if tel:
        if tel in seen_tels:
            errs.append(f"電話番号 {tel} がCSV内で重複")
        elif tel in db_tels:
            errs.append(f"電話番号 {tel} はすでに登録済み")
        else:
            seen_tels.add(tel)

    if errs:
        return ImportRowResult(row=idx, status="error", reason=" / ".join(errs), data=d)
    return ImportRowResult(row=idx, status="ok", data=d)


@router.post("/customers", response_model=ImportResult)
async def import_customers(
    request: Request,
    file: UploadFile = File(...),
    dry_run: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> ImportResult:
    store_id = _get_store_id(request)
    if not store_id:
        raise HTTPException(status_code=401, detail="認証が必要です")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ファイルは5MB以下にしてください")

    rows = _parse(_decode(content))
    if not rows:
        return ImportResult(total=0, valid=0, errors=0, imported=0, rows=[])

    # DB 上の既存電話番号（store 内）
    db_tels: set = {
        v for v in db.execute(
            select(CustomerORM.tel).where(
                CustomerORM.store_id == store_id,
                CustomerORM.tel.isnot(None),
            )
        ).scalars().all()
        if v
    }

    seen_tels: set = set()
    results: List[ImportRowResult] = []
    for idx, row in enumerate(rows, start=2):
        results.append(_validate_customer(idx, row, seen_tels, db_tels))

    valid = [r for r in results if r.status == "ok"]
    imported = 0

    if not dry_run and valid:
        now = _utcnow()
        for r in valid:
            d = r.data
            db.add(CustomerORM(
                id=uuid4(),
                store_id=store_id,
                name=d["顧客名"],
                name_kana=d["フリガナ"] or None,
                honorific=d["敬称"] or "御中",
                postal_code=d["郵便番号"] or None,
                address1=d["住所1"] or None,
                address2=d["住所2"] or None,
                tel=d["電話番号"] or None,
                email=d["メール"] or None,
                contact_person=d["担当者名"] or None,
                payment_terms=d["支払条件"] or None,
                created_at=now,
                updated_at=now,
            ))
        db.commit()
        imported = len(valid)

    return ImportResult(
        total=len(rows),
        valid=len(valid),
        errors=len(results) - len(valid),
        imported=imported,
        rows=results,
    )
