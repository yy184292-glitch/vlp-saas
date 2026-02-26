from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP
from pathlib import Path
from typing import Any, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.billing import BillingDocumentORM, BillingLineORM
from app.models.billing_sequence import BillingSequenceORM
from app.models.system_setting import SystemSettingORM
from app.schemas.billing import (
    BillingCreateIn,
    BillingImportIn,
    BillingImportOut,
    BillingLineIn,
    BillingLineOut,
    BillingOut,
    BillingUpdateIn,
)

router = APIRouter(tags=["billing"])


# ============================================================
# utils
# ============================================================

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _jsonb_safe(v: Any) -> Any:
    return json.loads(json.dumps(v))


def _get_actor_store_id(request: Request) -> Optional[UUID]:
    user = getattr(request.state, "user", None)
    store_id = getattr(user, "store_id", None)
    if isinstance(store_id, UUID):
        return store_id
    if isinstance(store_id, str):
        try:
            return UUID(store_id)
        except Exception:
            return None
    return None


def _assert_scope(doc: BillingDocumentORM, store_id: Optional[UUID]) -> None:
    # 互換: doc.store_id が None のデータは許可（移行期間向け）
    if doc.store_id is None:
        return
    if store_id is None:
        return
    if doc.store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")


def _to_out(doc: BillingDocumentORM) -> BillingOut:
    return BillingOut(
        id=doc.id,
        store_id=doc.store_id,
        kind=doc.kind,
        status=doc.status,
        doc_no=getattr(doc, "doc_no", None),
        customer_name=doc.customer_name,
        subtotal=doc.subtotal,
        tax_total=doc.tax_total,
        total=doc.total,
        tax_rate=doc.tax_rate,
        tax_mode=doc.tax_mode,
        tax_rounding=doc.tax_rounding,
        issued_at=doc.issued_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ============================================================
# tax
# ============================================================

def _get_tax_defaults(db: Session) -> tuple[Decimal, str, str]:
    row = db.execute(
        select(SystemSettingORM).where(SystemSettingORM.key == "tax")
    ).scalar_one_or_none()

    if not row or not isinstance(row.value, dict):
        return Decimal("0.10"), "exclusive", "floor"

    rate = Decimal(str(row.value.get("rate", "0.10")))
    mode = str(row.value.get("mode", "exclusive"))
    rounding = str(row.value.get("rounding", "floor"))
    return rate, mode, rounding


def _round_tax(value: Decimal, rounding: str) -> int:
    if rounding == "floor":
        return int(value.to_integral_value(rounding=ROUND_FLOOR))
    if rounding == "ceil":
        return int(value.to_integral_value(rounding=ROUND_CEILING))
    return int(value.to_integral_value(rounding=ROUND_HALF_UP))


def _recalc(
    lines: list[BillingLineIn],
    tax_rate: Decimal,
    tax_mode: str,
    tax_rounding: str,
) -> tuple[int, int, int]:
    subtotal = 0
    for ln in lines:
        qty = Decimal(str(ln.qty or 0))
        unit_price = Decimal(str(ln.unit_price or 0))
        subtotal += int(qty * unit_price)

    subtotal_dec = Decimal(subtotal)

    if tax_mode == "inclusive":
        tax = subtotal_dec * tax_rate / (Decimal("1") + tax_rate)
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal
    else:
        tax = subtotal_dec * tax_rate
        tax_total = _round_tax(tax, tax_rounding)
        total = subtotal + tax_total

    return subtotal, tax_total, total


# ============================================================
# doc_no sequence
# ============================================================

def _next_doc_no(db: Session, store_id: UUID, kind: str) -> str:
    year = datetime.now().year
    seq = db.execute(
        select(BillingSequenceORM)
        .where(
            and_(
                BillingSequenceORM.store_id == store_id,
                BillingSequenceORM.year == year,
                BillingSequenceORM.kind == kind,
            )
        )
        .with_for_update()
    ).scalar_one_or_none()

    if not seq:
        seq = BillingSequenceORM(
            store_id=store_id,
            year=year,
            kind=kind,
            next_no=1,
        )
        db.add(seq)
        db.flush()

    n = int(seq.next_no)
    seq.next_no = n + 1

    prefix = "INV" if kind == "invoice" else "EST"
    return f"{prefix}-{year}-{n:05d}"


# ============================================================
# list / get
# ============================================================

@router.get("/billing", response_model=List[BillingOut])
def list_billing(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    status: str | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
) -> List[BillingOut]:
    stmt = select(BillingDocumentORM)

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None:
        stmt = stmt.where(BillingDocumentORM.store_id == actor_store_id)

    if status:
        stmt = stmt.where(BillingDocumentORM.status == status)
    if kind:
        stmt = stmt.where(BillingDocumentORM.kind == kind)

    stmt = stmt.order_by(BillingDocumentORM.created_at.desc()).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()
    return [_to_out(x) for x in rows]


@router.get("/billing/{billing_id}", response_model=BillingOut)
def get_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))
    return _to_out(doc)


# ============================================================
# lines
# ============================================================

@router.get("/billing/{billing_id}/lines", response_model=List[BillingLineOut])
def list_billing_lines(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> List[BillingLineOut]:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    stmt = (
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    )
    return db.execute(stmt).scalars().all()


# ============================================================
# create / update
# ============================================================

@router.post("/billing", response_model=BillingOut)
def create_billing(
    request: Request,
    body: BillingCreateIn,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    actor_store_id = _get_actor_store_id(request)
    store_id = actor_store_id or body.store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    tax_rate, tax_mode, tax_rounding = _get_tax_defaults(db)

    subtotal, tax_total, total = _recalc(
        body.lines,
        tax_rate,
        tax_mode,
        tax_rounding,
    )

    kind = body.kind or "invoice"
    doc_no = _next_doc_no(db, store_id, kind)

    issued_at = body.issued_at
    status = body.status or "draft"
    if status == "issued" and issued_at is None:
        issued_at = now

    doc = BillingDocumentORM(
        id=uuid4(),
        store_id=store_id,
        kind=kind,
        status=status,
        doc_no=doc_no,
        customer_name=body.customer_name,
        subtotal=subtotal,
        tax_total=tax_total,
        total=total,
        tax_rate=tax_rate,
        tax_mode=tax_mode,
        tax_rounding=tax_rounding,
        issued_at=issued_at,
        source_work_order_id=getattr(body, "source_work_order_id", None),
        meta=_jsonb_safe(body.meta or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(doc)

    for i, ln in enumerate(body.lines):
        amount = int(Decimal(str(ln.qty or 0)) * Decimal(str(ln.unit_price or 0)))
        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=doc.id,
                name=ln.name,
                qty=float(ln.qty or 0),
                unit=ln.unit,
                unit_price=int(ln.unit_price or 0),
                cost_price=int(ln.cost_price or 0),
                amount=amount,
                sort_order=i,
                created_at=now,
            )
        )

    db.commit()
    db.refresh(doc)
    return _to_out(doc)


@router.put("/billing/{billing_id}", response_model=BillingOut)
def update_billing(
    request: Request,
    billing_id: UUID,
    body: BillingUpdateIn,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    if body.kind is not None:
        doc.kind = body.kind
        # kind変更を許すなら、doc_no再採番ポリシーが必要になるので通常は非推奨

    if body.status is not None:
        doc.status = body.status
        if body.status == "issued" and doc.issued_at is None:
            doc.issued_at = now

    if body.customer_name is not None:
        doc.customer_name = body.customer_name

    if body.meta is not None:
        doc.meta = _jsonb_safe(body.meta)

    if body.lines is not None:
        db.execute(delete(BillingLineORM).where(BillingLineORM.billing_id == billing_id))

        subtotal, tax_total, total = _recalc(
            body.lines,
            doc.tax_rate,
            doc.tax_mode,
            doc.tax_rounding,
        )
        doc.subtotal = subtotal
        doc.tax_total = tax_total
        doc.total = total

        for i, ln in enumerate(body.lines):
            amount = int(Decimal(str(ln.qty or 0)) * Decimal(str(ln.unit_price or 0)))
            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=float(ln.qty or 0),
                    unit=ln.unit,
                    unit_price=int(ln.unit_price or 0),
                    cost_price=int(ln.cost_price or 0),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

    doc.updated_at = now
    db.commit()
    db.refresh(doc)
    return _to_out(doc)


# ============================================================
# issue
# ============================================================

@router.post("/billing/{billing_id}/issue", response_model=BillingOut)
def issue_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    doc.status = "issued"
    if doc.issued_at is None:
        doc.issued_at = now
    doc.updated_at = now

    db.commit()
    db.refresh(doc)
    return _to_out(doc)


# ============================================================
# convert estimate → invoice
# ============================================================

@router.post("/billing/{billing_id}/convert", response_model=BillingOut)
def convert_to_invoice(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> BillingOut:
    now = _utcnow()

    source = db.get(BillingDocumentORM, billing_id)
    if not source:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    _assert_scope(source, actor_store_id)

    if source.kind != "estimate":
        raise HTTPException(status_code=400, detail="Only estimate can convert")

    store_id = source.store_id or actor_store_id
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id required")

    # lines copy
    src_lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == source.id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    invoice_id = uuid4()
    doc_no = _next_doc_no(db, store_id, "invoice")

    invoice = BillingDocumentORM(
        id=invoice_id,
        store_id=store_id,
        kind="invoice",
        status="draft",
        doc_no=doc_no,
        customer_name=source.customer_name,
        subtotal=source.subtotal,
        tax_total=source.tax_total,
        total=source.total,
        tax_rate=source.tax_rate,
        tax_mode=source.tax_mode,
        tax_rounding=source.tax_rounding,
        issued_at=None,
        source_work_order_id=source.source_work_order_id,
        meta=_jsonb_safe(source.meta or {}),
        created_at=now,
        updated_at=now,
    )
    db.add(invoice)

    for ln in src_lines:
        db.add(
            BillingLineORM(
                id=uuid4(),
                billing_id=invoice_id,
                name=ln.name,
                qty=ln.qty,
                unit=ln.unit,
                unit_price=ln.unit_price,
                cost_price=ln.cost_price,
                amount=ln.amount,
                sort_order=ln.sort_order,
                created_at=now,
            )
        )

    db.commit()
    db.refresh(invoice)
    return _to_out(invoice)


# ============================================================
# delete
# ============================================================

@router.delete("/billing/{billing_id}")
def delete_billing(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    db.execute(delete(BillingLineORM).where(BillingLineORM.billing_id == billing_id))
    db.delete(doc)
    db.commit()
    return {"deleted": True}


# ============================================================
# CSV export (1枚分)
# ============================================================

@router.get("/billing/{billing_id}/export.csv")
def export_billing_csv(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
):
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["billing_id", str(doc.id)])
    w.writerow(["doc_no", getattr(doc, "doc_no", "") or ""])
    w.writerow(["customer_name", doc.customer_name or ""])
    w.writerow(["kind", doc.kind])
    w.writerow(["status", doc.status])
    w.writerow(["issued_at", doc.issued_at.isoformat() if doc.issued_at else ""])
    w.writerow([])
    w.writerow(["name", "qty", "unit_price", "amount"])

    for ln in lines:
        w.writerow([ln.name, ln.qty, ln.unit_price, ln.amount])

    w.writerow([])
    w.writerow(["subtotal", doc.subtotal])
    w.writerow(["tax_total", doc.tax_total])
    w.writerow(["total", doc.total])

    data = buf.getvalue().encode("utf-8-sig")  # Excel向けBOM

    filename = f"billing_{doc.id}.csv"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# PDF export (1枚分) : reportlab (Japanese font)
# ============================================================

@router.get("/billing/{billing_id}/export.pdf")
def export_billing_pdf(
    request: Request,
    billing_id: UUID,
    db: Session = Depends(get_db),
):
    doc = db.get(BillingDocumentORM, billing_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    _assert_scope(doc, _get_actor_store_id(request))

    lines = db.execute(
        select(BillingLineORM)
        .where(BillingLineORM.billing_id == billing_id)
        .order_by(BillingLineORM.sort_order.asc())
    ).scalars().all()

    # 依存: reportlab
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    # ---- Font (Japanese) ----
    font_path = (
        Path(__file__).resolve().parents[1]
        / "assets"
        / "fonts"
        / "NotoSansJP-Regular.ttf"
    )
    if not font_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Japanese font not found: {font_path}",
        )

    try:
        pdfmetrics.getFont("NotoSansJP")
    except Exception:
        pdfmetrics.registerFont(TTFont("NotoSansJP", str(font_path)))

    out = io.BytesIO()
    c = canvas.Canvas(out, pagesize=A4)
    width, height = A4  # noqa: F841

    def set_font(size: int) -> None:
        c.setFont("NotoSansJP", size)

    def draw_kv(label: str, value: str, y: float) -> float:
        set_font(10)
        c.drawString(40, y, f"{label}: {value}")
        return y - 14

    def yen(n: int) -> str:
        try:
            return f"¥{int(n):,}"
        except Exception:
            return "¥0"

    # ---- Header ----
    y = height - 48
    set_font(18)
    title = "請求書" if doc.kind == "invoice" else "見積書"
    c.drawString(40, y, title)

    set_font(10)
    c.drawRightString(560, y, f"ID: {doc.id}")
    y -= 18
    c.drawRightString(560, y, f"No: {getattr(doc, 'doc_no', '') or '-'}")
    y -= 18

    y = draw_kv("顧客", doc.customer_name or "-", y)
    y = draw_kv("状態", doc.status or "-", y)
    issued = doc.issued_at.isoformat() if doc.issued_at else "-"
    y = draw_kv("発行日", issued, y)
    y -= 10

    # ---- Table header ----
    set_font(10)
    c.line(40, y, 560, y)
    y -= 16

    set_font(10)
    c.drawString(40, y, "名称")
    c.drawRightString(360, y, "数量")
    c.drawRightString(460, y, "単価")
    c.drawRightString(560, y, "金額")
    y -= 10
    c.line(40, y, 560, y)
    y -= 16

    # ---- Rows ----
    set_font(10)

    def new_page() -> float:
        c.showPage()
        set_font(14)
        y2 = height - 48
        c.drawString(40, y2, title)
        set_font(10)
        c.drawRightString(560, y2, f"ID: {doc.id}")
        y2 -= 18
        c.drawRightString(560, y2, f"No: {getattr(doc, 'doc_no', '') or '-'}")
        y2 -= 18

        c.line(40, y2, 560, y2)
        y2 -= 16
        c.drawString(40, y2, "名称")
        c.drawRightString(360, y2, "数量")
        c.drawRightString(460, y2, "単価")
        c.drawRightString(560, y2, "金額")
        y2 -= 10
        c.line(40, y2, 560, y2)
        y2 -= 16
        return y2

    for ln in lines:
        if y < 90:
            y = new_page()

        name = (ln.name or "")[:60]
        c.drawString(40, y, name)
        c.drawRightString(360, y, f"{float(ln.qty):g}")
        c.drawRightString(460, y, f"{int(ln.unit_price):,}")
        c.drawRightString(560, y, f"{int(ln.amount):,}")
        y -= 14

    # ---- Totals ----
    y -= 6
    c.line(40, y, 560, y)
    y -= 18

    set_font(11)
    c.drawRightString(520, y, "小計")
    c.drawRightString(560, y, yen(doc.subtotal))
    y -= 14
    c.drawRightString(520, y, "税")
    c.drawRightString(560, y, yen(doc.tax_total))
    y -= 14

    set_font(12)
    c.drawRightString(520, y, "合計")
    c.drawRightString(560, y, yen(doc.total))

    c.showPage()
    c.save()

    out.seek(0)
    filename = f"billing_{doc.id}.pdf"
    return StreamingResponse(
        out,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# IMPORT（既存維持）
# ============================================================

@router.post("/billing/import", response_model=BillingImportOut)
def import_billing(
    body: BillingImportIn,
    db: Session = Depends(get_db),
) -> BillingImportOut:
    now = _utcnow()
    inserted = 0

    for it in body.items:
        lines_in: list[BillingLineIn] = []
        for raw in (it.lines or []):
            if not isinstance(raw, dict):
                continue

            name = str(raw.get("name") or "明細").strip()
            if not name:
                continue

            try:
                qty = float(raw.get("qty") or 0)
            except Exception:
                qty = 0.0

            unit_price_raw = raw.get("unit_price")
            if unit_price_raw is None:
                unit_price_raw = raw.get("unitPrice")

            try:
                unit_price = int(unit_price_raw) if unit_price_raw is not None else 0
            except Exception:
                unit_price = 0

            unit = raw.get("unit")
            unit_s = str(unit).strip() if unit is not None else None

            lines_in.append(
                BillingLineIn(
                    name=name,
                    qty=qty,
                    unit=unit_s,
                    unit_price=unit_price,
                )
            )

        # importは過去データなので tax はデフォルトで計算（仕様に合わせて変更可）
        tax_rate, tax_mode, tax_rounding = _get_tax_defaults(db)
        subtotal, tax_total, total = _recalc(lines_in, tax_rate, tax_mode, tax_rounding)

        billing_id = uuid4()
        doc = BillingDocumentORM(
            id=billing_id,
            store_id=None,
            kind=it.kind or "invoice",
            status=it.status or "draft",
            doc_no=None,
            customer_name=it.customerName,
            subtotal=subtotal,
            tax_total=tax_total,
            total=total,
            tax_rate=tax_rate,
            tax_mode=tax_mode,
            tax_rounding=tax_rounding,
            issued_at=now,
            source_work_order_id=None,
            meta=_jsonb_safe({"_import": "localStorage"}),
            created_at=now,
            updated_at=now,
        )
        db.add(doc)

        for i, ln in enumerate(lines_in):
            amount = int(Decimal(str(ln.qty or 0)) * Decimal(str(ln.unit_price or 0)))
            db.add(
                BillingLineORM(
                    id=uuid4(),
                    billing_id=billing_id,
                    name=ln.name,
                    qty=float(ln.qty or 0),
                    unit=ln.unit,
                    unit_price=int(ln.unit_price or 0),
                    cost_price=int(getattr(ln, "cost_price", 0) or 0),
                    amount=amount,
                    sort_order=i,
                    created_at=now,
                )
            )

        inserted += 1

    db.commit()
    return BillingImportOut(inserted=inserted)
