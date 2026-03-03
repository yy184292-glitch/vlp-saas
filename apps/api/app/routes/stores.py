from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.asset import AssetORM
from app.models.store import StoreORM
from app.schemas.store import StoreCreateIn, StoreOut, StoreUpdateIn

router = APIRouter(tags=["stores"])


def _uploads_root() -> Path:
    # api/ 配下に uploads を作る（既存の expenses 添付と同じ方針）
    api_root = Path(__file__).resolve().parents[3]
    return api_root / "uploads"


def _logo_url(store_id: UUID) -> str:
    return f"/api/v1/stores/{store_id}/logo"


def _attach_logo_url(db: Session, row: StoreORM) -> StoreOut:
    # StoreOut を返す直前にロゴの有無を確認して URL を埋める
    logo = (
        db.execute(
            select(AssetORM)
            .where(AssetORM.store_id == row.id, AssetORM.kind == "logo")
            .order_by(AssetORM.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )

    out = StoreOut.model_validate(row)
    if logo:
        out.logo_url = _logo_url(row.id)
    return out


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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


@router.get("/stores", response_model=List[StoreOut])
def list_stores(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> List[StoreOut]:
    """
    注意:
    - 本来は「自分の store_id のみ返す」でも良い。
    - ただし現状 request.state.user が無いケースもあるので、
      store_id が取れない場合は全件返す（開発用）。
    """
    stmt = select(StoreORM).order_by(StoreORM.created_at.desc()).limit(limit).offset(offset)

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None:
        stmt = stmt.where(StoreORM.id == actor_store_id)

    rows = db.execute(stmt).scalars().all()
    return [_attach_logo_url(db, r) for r in rows]


@router.get("/stores/{store_id}", response_model=StoreOut)
def get_store(
    request: Request,
    store_id: UUID,
    db: Session = Depends(get_db),
) -> StoreOut:
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    return _attach_logo_url(db, row)


@router.post("/stores", response_model=StoreOut)
def create_store(
    body: StoreCreateIn,
    db: Session = Depends(get_db),
) -> StoreOut:
    now = _utcnow()
    row = StoreORM(
        id=uuid4(),
        name=body.name,
        postal_code=body.postal_code,
        address1=body.address1,
        address2=body.address2,
        tel=body.tel,
        email=body.email,
        invoice_number=body.invoice_number,
        bank_name=body.bank_name,
        bank_branch=body.bank_branch,
        bank_account_type=body.bank_account_type,
        bank_account_number=body.bank_account_number,
        bank_account_holder=body.bank_account_holder,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _attach_logo_url(db, row)


@router.put("/stores/{store_id}", response_model=StoreOut)
def update_store(
    request: Request,
    store_id: UUID,
    body: StoreUpdateIn,
    db: Session = Depends(get_db),
) -> StoreOut:
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    # 部分更新
    for k, v in body.dict(exclude_unset=True).items():
        setattr(row, k, v)

    row.updated_at = _utcnow()
    db.commit()
    db.refresh(row)
    return _attach_logo_url(db, row)


@router.post("/stores/{store_id}/logo", response_model=StoreOut)
async def upload_store_logo(
    request: Request,
    store_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> StoreOut:
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    if not file:
        raise HTTPException(status_code=400, detail="file required")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    content_type = (file.content_type or "").lower()
    if not (content_type.startswith("image/")):
        raise HTTPException(status_code=400, detail="logo must be an image")

    base_dir = _uploads_root() / "assets" / str(store_id) / "logo"
    base_dir.mkdir(parents=True, exist_ok=True)

    ext = os.path.splitext(file.filename or "logo.png")[1].lower() or ".png"
    save_path = base_dir / f"{uuid4()}{ext}"
    save_path.write_bytes(content)

    # 既存ロゴを消して最新のみ残す（DBとファイルの整合は最小限）
    old = db.execute(select(AssetORM).where(AssetORM.store_id == store_id, AssetORM.kind == "logo")).scalars().all()
    for o in old:
        try:
            p = Path(o.file_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass
        db.delete(o)

    asset = AssetORM(
        store_id=store_id,
        kind="logo",
        content_type=content_type,
        file_path=str(save_path),
    )
    db.add(asset)
    db.commit()

    return _attach_logo_url(db, row)


@router.get("/stores/{store_id}/logo")
def download_store_logo(
    request: Request,
    store_id: UUID,
    db: Session = Depends(get_db),
):
    row = db.get(StoreORM, store_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")

    actor_store_id = _get_actor_store_id(request)
    if actor_store_id is not None and actor_store_id != store_id:
        raise HTTPException(status_code=404, detail="Not found")

    logo = (
        db.execute(
            select(AssetORM)
            .where(AssetORM.store_id == store_id, AssetORM.kind == "logo")
            .order_by(AssetORM.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    if not logo:
        raise HTTPException(status_code=404, detail="Not found")

    path = Path(logo.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=str(path),
        media_type=logo.content_type or "application/octet-stream",
        filename=os.path.basename(logo.file_path) or "logo",
    )