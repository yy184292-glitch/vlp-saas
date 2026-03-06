"""SNS自動投稿 API ルート

GET  /sns/settings              SNS設定取得（なければデフォルト作成）
PUT  /sns/settings              SNS設定更新
GET  /sns/posts                 投稿履歴一覧
POST /sns/posts                 手動投稿
POST /sns/posts/{id}/retry      失敗投稿のリトライ
GET  /sns/preview               投稿プレビュー生成
GET  /sns/repost-schedule       定期再投稿候補一覧
POST /sns/trigger               車両イベントからの自動トリガー
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps.auth import get_current_user
from app.models.car import Car
from app.models.sns_post import SnsPostORM, SnsSettingORM
from app.models.store import StoreORM as Store
from app.schemas.sns import (
    RepostScheduleItem,
    SnsPostCreate,
    SnsPostListOut,
    SnsPostOut,
    SnsPreviewOut,
    SnsSettingOut,
    SnsSettingUpdate,
)
from app.services.sns_service import (
    execute_sns_post,
    generate_caption,
    get_repost_due_cars,
)
from app.models.user import User

router = APIRouter(tags=["sns"])


# ─── ヘルパー ────────────────────────────────────────────────

def _get_store_id(user: User) -> UUID:
    sid = getattr(user, "store_id", None)
    if not sid:
        raise HTTPException(status_code=400, detail="store_id required")
    return sid


def _get_or_create_setting(db: Session, store_id: UUID) -> SnsSettingORM:
    row = db.execute(
        select(SnsSettingORM).where(SnsSettingORM.store_id == store_id)
    ).scalar_one_or_none()
    if not row:
        row = SnsSettingORM(id=uuid.uuid4(), store_id=store_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _get_store_name(db: Session, store_id: UUID) -> str:
    store = db.get(Store, store_id)
    return getattr(store, "name", "") if store else ""


def _get_template(setting: SnsSettingORM, trigger: str) -> str:
    if trigger == "new_arrival":
        return setting.new_arrival_template
    if trigger == "price_down":
        return setting.price_down_template
    if trigger in ("sold_out", "repost"):
        return setting.sold_out_template if trigger == "sold_out" else setting.new_arrival_template
    return setting.new_arrival_template


# ─── Settings エンドポイント ─────────────────────────────────

@router.get("/sns/settings", response_model=SnsSettingOut)
def get_sns_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsSettingOut:
    sid = _get_store_id(user)
    return _get_or_create_setting(db, sid)


@router.put("/sns/settings", response_model=SnsSettingOut)
def update_sns_settings(
    body: SnsSettingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsSettingOut:
    sid = _get_store_id(user)
    row = _get_or_create_setting(db, sid)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ─── Posts エンドポイント ────────────────────────────────────

@router.get("/sns/posts", response_model=SnsPostListOut)
def list_sns_posts(
    trigger: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsPostListOut:
    sid = _get_store_id(user)
    cond = [SnsPostORM.store_id == sid]
    if trigger:
        cond.append(SnsPostORM.trigger == trigger)
    if platform:
        cond.append(SnsPostORM.platform == platform)
    if status:
        cond.append(SnsPostORM.status == status)

    from sqlalchemy import func, select as sa_select
    total = db.execute(
        sa_select(func.count()).select_from(SnsPostORM).where(and_(*cond))
    ).scalar_one()

    rows = db.execute(
        select(SnsPostORM)
        .where(and_(*cond))
        .order_by(SnsPostORM.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return SnsPostListOut(items=list(rows), total=int(total))


@router.post("/sns/posts", response_model=SnsPostOut)
async def create_sns_post(
    body: SnsPostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsPostOut:
    sid = _get_store_id(user)
    setting = _get_or_create_setting(db, sid)

    caption = body.caption
    car_data: dict = {}
    if body.car_id:
        car = db.get(Car, body.car_id)
        if not car or car.store_id != sid:
            raise HTTPException(status_code=404, detail="car not found")
        car_data = {c.name: getattr(car, c.name) for c in Car.__table__.columns}

    post = SnsPostORM(
        id=uuid.uuid4(),
        store_id=sid,
        car_id=body.car_id,
        trigger=body.trigger,
        platform=body.platform,
        status="pending",
        caption=caption,
        image_urls=body.image_urls,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # 非同期で実際に投稿
    ok, err = await execute_sns_post(caption, body.image_urls, body.platform, setting)
    post.status = "posted" if ok else "failed"
    post.posted_at = datetime.now(timezone.utc) if ok else None
    post.error_message = err
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/sns/posts/{post_id}/retry", response_model=SnsPostOut)
async def retry_sns_post(
    post_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsPostOut:
    sid = _get_store_id(user)
    post = db.get(SnsPostORM, post_id)
    if not post or post.store_id != sid:
        raise HTTPException(status_code=404, detail="not found")
    if post.status not in ("failed", "skipped"):
        raise HTTPException(status_code=400, detail="failed/skipped の投稿のみリトライ可能です")

    setting = _get_or_create_setting(db, sid)
    ok, err = await execute_sns_post(post.caption, post.image_urls, post.platform, setting)
    post.status = "posted" if ok else "failed"
    post.posted_at = datetime.now(timezone.utc) if ok else None
    post.error_message = err
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


# ─── Preview ─────────────────────────────────────────────────

@router.get("/sns/preview", response_model=List[SnsPreviewOut])
def preview_sns_post(
    car_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[SnsPreviewOut]:
    sid = _get_store_id(user)
    car = db.get(Car, car_id)
    if not car or car.store_id != sid:
        raise HTTPException(status_code=404, detail="car not found")

    setting = _get_or_create_setting(db, sid)
    store_name = _get_store_name(db, sid)
    car_data = {c.name: getattr(car, c.name) for c in Car.__table__.columns}

    previews = []
    for trigger in ("new_arrival", "price_down", "sold_out"):
        template = _get_template(setting, trigger)
        caption = generate_caption(car_data, trigger, template, store_name)
        previews.append(SnsPreviewOut(trigger=trigger, caption=caption))
    return previews


# ─── 定期再投稿スケジュール ──────────────────────────────────

@router.get("/sns/repost-schedule", response_model=List[RepostScheduleItem])
def get_repost_schedule(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[RepostScheduleItem]:
    sid = _get_store_id(user)
    setting = _get_or_create_setting(db, sid)

    if not setting.repost_enabled:
        return []

    due = get_repost_due_cars(db, sid, setting.repost_interval_weeks)
    return [
        RepostScheduleItem(
            car_id=item["car_id"],
            car_name=item["car_name"],
            last_posted_at=item["last_posted_at"],
            next_repost_at=item["next_repost_at"],
            overdue=item["overdue"],
        )
        for item in due
    ]


# ─── 車両イベント自動トリガー ────────────────────────────────

class SnsTriggerRequest(SnsPostCreate):
    """内部向け：車両登録・価格変更・売却時に呼び出す"""
    pass


@router.post("/sns/trigger", response_model=SnsPostOut)
async def trigger_sns_post(
    body: SnsTriggerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnsPostOut:
    """
    車両ステータス変化（new_arrival / price_down / sold_out）時に呼び出す。
    SNS設定の auto_* フラグが False の場合は skipped で記録。
    """
    sid = _get_store_id(user)
    setting = _get_or_create_setting(db, sid)

    # auto_* フラグチェック
    auto_flags = {
        "new_arrival": setting.auto_new_arrival,
        "price_down": setting.auto_price_down,
        "sold_out": setting.auto_sold_out,
    }
    auto_ok = auto_flags.get(body.trigger, True)

    # キャプション生成
    caption = body.caption
    if body.car_id and not caption:
        car = db.get(Car, body.car_id)
        if car and car.store_id == sid:
            store_name = _get_store_name(db, sid)
            car_data = {c.name: getattr(car, c.name) for c in Car.__table__.columns}
            template = _get_template(setting, body.trigger)
            caption = generate_caption(car_data, body.trigger, template, store_name)

    post = SnsPostORM(
        id=uuid.uuid4(),
        store_id=sid,
        car_id=body.car_id,
        trigger=body.trigger,
        platform=body.platform,
        status="pending",
        caption=caption or "",
        image_urls=body.image_urls,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    if not auto_ok:
        post.status = "skipped"
        post.error_message = "auto_* フラグが無効のためスキップ"
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    ok, err = await execute_sns_post(caption or "", body.image_urls, body.platform, setting)
    post.status = "posted" if ok else "failed"
    post.posted_at = datetime.now(timezone.utc) if ok else None
    post.error_message = err
    db.add(post)
    db.commit()
    db.refresh(post)
    return post
