from __future__ import annotations

import csv
import io
import os
from pathlib import Path
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

import pytesseract
from PIL import Image


from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.expense import ExpenseORM
from app.models.expense_attachment import ExpenseAttachmentORM
from app.models.master_category import ExpenseCategoryORM
from app.models.store_setting import StoreSettingORM
from app.models.user import User

router = APIRouter(tags=["expenses"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_date(value: str) -> date:
    try:
        # YYYY-MM-DD
        return date.fromisoformat(value)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid date: {value}") from e


def _resolve_store_id(user: User, store_id: Optional[UUID]) -> UUID:
    """store_id の決定

def _normalize_name(name: str) -> str:
    return " ".join((name or "").strip().split())


def _get_or_create_store_settings(db: Session, store_id: UUID) -> StoreSettingORM:
    row = db.get(StoreSettingORM, store_id)
    if row:
        return row
    row = StoreSettingORM(store_id=store_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _ensure_expense_category(db: Session, store_id: UUID, category: str) -> None:
    name = _normalize_name(category)
    if not name:
        return
    # 既存があれば usage_count を増やす
    row = db.execute(
        select(ExpenseCategoryORM).where(
            ExpenseCategoryORM.store_id == store_id, ExpenseCategoryORM.name == name
        )
    ).scalar_one_or_none()
    if row:
        row.usage_count = int(row.usage_count or 0) + 1
        db.add(row)
        return
    # 無ければ作る（競合したら既存を採用）
    row = ExpenseCategoryORM(store_id=store_id, name=name, is_system=False, usage_count=1)
    db.add(row)
    try:
        db.flush()
    except Exception:
        db.rollback()
        # 競合時は何もしない（次回以降にusage_countが増える）
        return


def _safe_filename(name: str) -> str:
    # パス注入対策：ファイル名のみ残す
    base = os.path.basename(name or "file")
    base = base.replace("\\", "_").replace("/", "_").strip()
    if not base:
        base = "file"
    return base


def _uploads_root() -> Path:
    # api/ 配下に uploads を作る
    here = Path(__file__).resolve()
    # app/routes/expenses.py -> app -> api root
    api_root = here.parents[2]
    return api_root / "uploads"
    - 原則: user.store_id があればそれを固定（他店を見れない）
    - 例外: user.store_id が無い運用（管理者）ならクエリ/ボディの store_id を必須
    """
    actor_store_id = getattr(user, "store_id", None)
    if isinstance(actor_store_id, UUID):
        if store_id and store_id != actor_store_id:
            raise HTTPException(status_code=404, detail="Not found")
        return actor_store_id

    # actor に store_id が無い → 指定必須
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")
    return store_id


# ============================================================
# schemas
# ============================================================

class ExpenseCreateIn(BaseModel):
    store_id: Optional[UUID] = None

    expense_date: date = Field(..., description="YYYY-MM-DD")
    category: str = Field(..., max_length=64)
    title: str = Field(..., max_length=255)

    vendor: Optional[str] = Field(default=None, max_length=255)
    amount: Decimal = Field(default=Decimal("0"))

    payment_method: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None


class ExpenseUpdateIn(BaseModel):
    expense_date: Optional[date] = None
    category: Optional[str] = Field(default=None, max_length=64)
    title: Optional[str] = Field(default=None, max_length=255)

    vendor: Optional[str] = Field(default=None, max_length=255)
    amount: Optional[Decimal] = None

    payment_method: Optional[str] = Field(default=None, max_length=64)
    note: Optional[str] = None


class ExpenseOut(BaseModel):
    id: UUID
    store_id: UUID

    expense_date: date
    category: str
    title: str

    vendor: Optional[str]
    amount: Decimal

    payment_method: Optional[str]
    note: Optional[str]

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseListOut(BaseModel):
    items: List[ExpenseOut]
    total: int


# ============================================================
# endpoints
# ============================================================

@router.get("/expenses", response_model=ExpenseListOut)
def list_expenses(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str = Query("", max_length=200),

    start: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end: Optional[str] = Query(default=None, description="YYYY-MM-DD"),

    category: Optional[str] = Query(default=None, max_length=64),
    store_id: Optional[UUID] = Query(default=None),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseListOut:
    sid = _resolve_store_id(user, store_id)

    cond = [ExpenseORM.store_id == sid]

    if start:
        cond.append(ExpenseORM.expense_date >= _to_date(start))
    if end:
        cond.append(ExpenseORM.expense_date <= _to_date(end))
    if category:
        cond.append(ExpenseORM.category == category)

    if q.strip():
        qs = f"%{q.strip()}%"
        cond.append(
            or_(
                ExpenseORM.title.ilike(qs),
                ExpenseORM.vendor.ilike(qs),
                ExpenseORM.note.ilike(qs),
            )
        )

    stmt = (
        select(ExpenseORM)
        .where(and_(*cond))
        .order_by(ExpenseORM.expense_date.desc(), ExpenseORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = db.execute(stmt).scalars().all()

    total = db.execute(
        select(func.count()).select_from(ExpenseORM).where(and_(*cond))
    ).scalar_one()

    return ExpenseListOut(items=items, total=int(total or 0))


@router.post("/expenses", response_model=ExpenseOut)
def create_expense(
    body: ExpenseCreateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    now = _utcnow()
    sid = _resolve_store_id(user, body.store_id)

    exp = ExpenseORM(
        id=uuid4(),
        store_id=sid,
        expense_date=body.expense_date,
        category=body.category.strip(),
        title=body.title.strip(),
        vendor=(body.vendor.strip() if body.vendor else None),
        amount=body.amount,
        payment_method=(body.payment_method.strip() if body.payment_method else None),
        note=body.note,
        created_at=now,
        updated_at=now,
    )

    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.get("/expenses/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: UUID,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")
    return exp


@router.put("/expenses/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: UUID,
    body: ExpenseUpdateIn,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExpenseOut:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    if body.expense_date is not None:
        exp.expense_date = body.expense_date
    if body.category is not None:
        exp.category = body.category.strip()
    if body.title is not None:
        exp.title = body.title.strip()
    if body.vendor is not None:
        exp.vendor = body.vendor.strip() if body.vendor else None
    if body.amount is not None:
        exp.amount = body.amount
    if body.payment_method is not None:
        exp.payment_method = body.payment_method.strip() if body.payment_method else None
    if body.note is not None:
        exp.note = body.note

    exp.updated_at = _utcnow()
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.delete("/expenses/{expense_id}", status_code=204)
def delete_expense(
    expense_id: UUID,
    store_id: Optional[UUID] = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if exp is None or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(exp)
    db.commit()
    return Response(status_code=204)


@router.get("/expenses/export")
def export_expenses_csv(
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    category: Optional[str] = Query(default=None, max_length=64),
    q: str = Query("", max_length=200),
    store_id: Optional[UUID] = Query(default=None),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """期間指定でCSV出力（Excel想定でUTF-8 BOM付き）"""
    sid = _resolve_store_id(user, store_id)

    d1 = _to_date(start)
    d2 = _to_date(end)
    if d2 < d1:
        raise HTTPException(status_code=400, detail="end must be >= start")

    cond = [
        ExpenseORM.store_id == sid,
        ExpenseORM.expense_date >= d1,
        ExpenseORM.expense_date <= d2,
    ]
    if category:
        cond.append(ExpenseORM.category == category)

    if q.strip():
        qs = f"%{q.strip()}%"
        cond.append(or_(ExpenseORM.title.ilike(qs), ExpenseORM.vendor.ilike(qs), ExpenseORM.note.ilike(qs)))

    rows = db.execute(
        select(ExpenseORM)
        .where(and_(*cond))
        .order_by(ExpenseORM.expense_date.asc(), ExpenseORM.created_at.asc())
    ).scalars().all()

    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(["日付", "カテゴリ", "件名", "取引先", "金額", "支払方法", "メモ", "登録日時"])
    for r in rows:
        writer.writerow([
            r.expense_date.isoformat(),
            r.category or "",
            r.title or "",
            r.vendor or "",
            str(r.amount) if r.amount is not None else "0",
            r.payment_method or "",
            (r.note or "").replace("\r", " ").replace("\n", " "),
            r.created_at.isoformat(),
        ])

    csv_text = out.getvalue()
    # Excel の文字化け回避（UTF-8 BOM）
    bom = "\ufeff"
    data = (bom + csv_text).encode("utf-8")

    filename = f"expenses_{d1.isoformat()}_{d2.isoformat()}.csv"
    return Response(
        content=data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Attachments (receipts)
# ============================================================

class ExpenseAttachmentOut(BaseModel):
    id: UUID
    expense_id: UUID
    filename: str
    content_type: str
    created_at: datetime
    has_ocr: bool = False

    class Config:
        from_attributes = True


@router.get("/expenses/{expense_id}/attachments", response_model=List[ExpenseAttachmentOut])
def list_expense_attachments(
    expense_id: UUID,
    store_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[ExpenseAttachmentOut]:
    sid = _resolve_store_id(user, store_id)
    exp = db.get(ExpenseORM, expense_id)
    if not exp or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    stmt = (
        select(ExpenseAttachmentORM)
        .where(ExpenseAttachmentORM.store_id == sid, ExpenseAttachmentORM.expense_id == expense_id)
        .order_by(ExpenseAttachmentORM.created_at.desc())
    )
    rows = db.execute(stmt).scalars().all()

    out: List[ExpenseAttachmentOut] = []
    for r in rows:
        out.append(
            ExpenseAttachmentOut(
                id=r.id,
                expense_id=r.expense_id,
                filename=r.filename,
                content_type=r.content_type,
                created_at=r.created_at,
                has_ocr=bool(r.ocr_text),
            )
        )
    return out


@router.post("/expenses/{expense_id}/attachments", response_model=ExpenseAttachmentOut)
async def upload_expense_attachment(
    request: Request,
    expense_id: UUID,
    file: UploadFile = File(...),
    store_id: Optional[UUID] = Query(None),
    do_ocr: bool = Query(True),
    ocr_lang: str = Query("jpn+eng"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ExpenseAttachmentOut:
    sid = _resolve_store_id(user, store_id)

    exp = db.get(ExpenseORM, expense_id)
    if not exp or exp.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    if not file:
        raise HTTPException(status_code=400, detail="file required")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    fname = _safe_filename(file.filename or "receipt")
    content_type = file.content_type or "application/octet-stream"

    # 保存先
    base_dir = _uploads_root() / "expenses" / str(sid) / str(expense_id)
    base_dir.mkdir(parents=True, exist_ok=True)

    # ファイル名衝突回避
    save_name = f"{uuid4()}_{fname}"
    save_path = base_dir / save_name
    save_path.write_bytes(contents)

    # OCR（画像のみ：png/jpg/jpeg/webp）
    ocr_text = None
    used_lang = None
    if do_ocr and content_type.lower().startswith("image/"):
        try:
            img = Image.open(save_path)
            # そこそこ効く設定：向き補正は別途だが、まずはベース
            ocr_text = pytesseract.image_to_string(img, lang=ocr_lang) or None
            used_lang = ocr_lang
        except Exception:
            # OCR失敗しても添付自体は成功扱い
            ocr_text = None
            used_lang = None

    row = ExpenseAttachmentORM(
        store_id=sid,
        expense_id=expense_id,
        filename=fname,
        content_type=content_type,
        storage_path=str(save_path),
        size_bytes=str(len(contents)),
        ocr_text=ocr_text,
        ocr_lang=used_lang,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ExpenseAttachmentOut(
        id=row.id,
        expense_id=row.expense_id,
        filename=row.filename,
        content_type=row.content_type,
        created_at=row.created_at,
        has_ocr=bool(row.ocr_text),
    )


@router.get("/expenses/attachments/{attachment_id}/download")
def download_expense_attachment(
    attachment_id: UUID,
    store_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    sid = _resolve_store_id(user, store_id)
    row = db.get(ExpenseAttachmentORM, attachment_id)
    if not row or row.store_id != sid:
        raise HTTPException(status_code=404, detail="Not found")

    path = Path(row.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=str(path),
        media_type=row.content_type or "application/octet-stream",
        filename=row.filename,
    )
