from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user, get_current_user
from app.models.line_setting import LineSettingORM
from app.models.line_customer import LineCustomerORM
from app.models.line_message import LineMessageORM
from app.services import line_service

router = APIRouter(
    prefix="/line",
    tags=["line"],
    dependencies=[Depends(attach_current_user)],
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_store(current_user) -> uuid.UUID:
    if not current_user.store_id:
        raise HTTPException(status_code=403, detail="店舗に所属していません")
    return current_user.store_id


def _require_admin(current_user) -> None:
    if current_user.role not in ("admin", "manager", "superadmin"):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")


def _get_setting(db: Session, store_id: uuid.UUID) -> LineSettingORM | None:
    return db.execute(
        select(LineSettingORM).where(LineSettingORM.store_id == store_id)
    ).scalar_one_or_none()


# ============================================================
# Pydantic スキーマ
# ============================================================

class LineSettingOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    channel_access_token: Optional[str] = None
    channel_secret: Optional[str] = None
    liff_id: Optional[str] = None
    auto_reply_enabled: bool
    auto_reply_message: Optional[str] = None
    welcome_message: Optional[str] = None

    model_config = {"from_attributes": True}


class LineSettingUpdate(BaseModel):
    channel_access_token: Optional[str] = None
    channel_secret: Optional[str] = None
    liff_id: Optional[str] = None
    auto_reply_enabled: Optional[bool] = None
    auto_reply_message: Optional[str] = None
    welcome_message: Optional[str] = None


class LineCustomerOut(BaseModel):
    id: uuid.UUID
    store_id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    line_user_id: str
    display_name: Optional[str] = None
    picture_url: Optional[str] = None
    follow_status: str
    followed_at: Optional[datetime] = None
    blocked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LineCustomerLinkRequest(BaseModel):
    customer_id: Optional[uuid.UUID] = None  # None で紐付け解除


class LineMessageOut(BaseModel):
    id: uuid.UUID
    line_customer_id: uuid.UUID
    direction: str
    message_type: str
    content: Optional[str] = None
    line_message_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    line_customer_id: Optional[uuid.UUID] = None
    line_user_id: Optional[str] = None  # line_customer_id が不明な場合の代替
    message: str


class BroadcastRequest(BaseModel):
    message: str


class NotifyWorkOrderRequest(BaseModel):
    line_customer_id: uuid.UUID
    car_name: str
    work_summary: str
    total_price: int
    detail_url: Optional[str] = "/"


class NotifyEstimateRequest(BaseModel):
    line_customer_id: uuid.UUID
    car_name: str
    estimate_price: int
    estimate_url: Optional[str] = "/"


# ============================================================
# 設定
# ============================================================

@router.get("/settings", response_model=LineSettingOut)
def get_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> LineSettingOut:
    store_id = _require_store(current_user)
    setting = _get_setting(db, store_id)
    if not setting:
        # デフォルト値を返す（未保存でも OK）
        setting = LineSettingORM(id=uuid.uuid4(), store_id=store_id, auto_reply_enabled=False)
    return LineSettingOut.model_validate(setting)


@router.put("/settings", response_model=LineSettingOut)
def update_settings(
    body: LineSettingUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> LineSettingOut:
    store_id = _require_store(current_user)
    _require_admin(current_user)

    setting = _get_setting(db, store_id)
    if not setting:
        setting = LineSettingORM(store_id=store_id)
        db.add(setting)

    if body.channel_access_token is not None:
        setting.channel_access_token = body.channel_access_token or None
    if body.channel_secret is not None:
        setting.channel_secret = body.channel_secret or None
    if body.liff_id is not None:
        setting.liff_id = body.liff_id or None
    if body.auto_reply_enabled is not None:
        setting.auto_reply_enabled = body.auto_reply_enabled
    if body.auto_reply_message is not None:
        setting.auto_reply_message = body.auto_reply_message or None
    if body.welcome_message is not None:
        setting.welcome_message = body.welcome_message or None

    setting.updated_at = _utcnow()
    db.commit()
    db.refresh(setting)
    return LineSettingOut.model_validate(setting)


@router.post("/settings/test")
def test_connection(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """接続テスト: LINE Messaging API の /bot/info を叩く"""
    store_id = _require_store(current_user)
    setting = _get_setting(db, store_id)
    if not setting or not setting.channel_access_token:
        raise HTTPException(status_code=400, detail="channel_access_token が未設定です")

    import httpx
    try:
        resp = httpx.get(
            "https://api.line.me/v2/bot/info",
            headers={"Authorization": f"Bearer {setting.channel_access_token}"},
            timeout=10,
        )
        if resp.status_code == 200:
            info = resp.json()
            return {"status": "ok", "bot_name": info.get("displayName"), "picture_url": info.get("pictureUrl")}
        return {"status": "error", "detail": f"LINE API {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ============================================================
# 顧客（友だち）
# ============================================================

@router.get("/customers", response_model=List[LineCustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[LineCustomerOut]:
    store_id = _require_store(current_user)
    rows = db.execute(
        select(LineCustomerORM)
        .where(LineCustomerORM.store_id == store_id)
        .order_by(LineCustomerORM.followed_at.desc())
    ).scalars().all()
    return [LineCustomerOut.model_validate(r) for r in rows]


@router.get("/customers/{lc_id}", response_model=LineCustomerOut)
def get_customer(
    lc_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> LineCustomerOut:
    store_id = _require_store(current_user)
    lc = db.execute(
        select(LineCustomerORM).where(LineCustomerORM.id == lc_id, LineCustomerORM.store_id == store_id)
    ).scalar_one_or_none()
    if not lc:
        raise HTTPException(status_code=404, detail="Not found")
    return LineCustomerOut.model_validate(lc)


@router.put("/customers/{lc_id}/link", response_model=LineCustomerOut)
def link_customer(
    lc_id: uuid.UUID,
    body: LineCustomerLinkRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> LineCustomerOut:
    """LINE 顧客を既存顧客と紐付け（customer_id=None で解除）"""
    store_id = _require_store(current_user)
    lc = db.execute(
        select(LineCustomerORM).where(LineCustomerORM.id == lc_id, LineCustomerORM.store_id == store_id)
    ).scalar_one_or_none()
    if not lc:
        raise HTTPException(status_code=404, detail="Not found")
    lc.customer_id = body.customer_id
    lc.updated_at = _utcnow()
    db.commit()
    db.refresh(lc)
    return LineCustomerOut.model_validate(lc)


# ============================================================
# メッセージ
# ============================================================

@router.get("/messages", response_model=List[LineMessageOut])
def list_messages(
    line_customer_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> List[LineMessageOut]:
    store_id = _require_store(current_user)
    stmt = (
        select(LineMessageORM)
        .where(LineMessageORM.store_id == store_id)
        .order_by(LineMessageORM.sent_at.asc())
    )
    if line_customer_id:
        stmt = stmt.where(LineMessageORM.line_customer_id == line_customer_id)
    rows = db.execute(stmt).scalars().all()
    return [LineMessageOut.model_validate(r) for r in rows]


@router.post("/messages/send")
def send_message_endpoint(
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    store_id = _require_store(current_user)
    setting = _get_setting(db, store_id)
    if not setting or not setting.channel_access_token:
        raise HTTPException(status_code=400, detail="LINE 設定が未完了です")

    # 送信先解決
    if body.line_customer_id:
        lc = db.execute(
            select(LineCustomerORM).where(
                LineCustomerORM.id == body.line_customer_id,
                LineCustomerORM.store_id == store_id,
            )
        ).scalar_one_or_none()
        if not lc:
            raise HTTPException(status_code=404, detail="LINE 顧客が見つかりません")
        line_user_id = lc.line_user_id
    elif body.line_user_id:
        line_user_id = body.line_user_id
        lc = db.execute(
            select(LineCustomerORM).where(
                LineCustomerORM.line_user_id == line_user_id,
                LineCustomerORM.store_id == store_id,
            )
        ).scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="line_customer_id または line_user_id が必要です")

    ok, err = line_service.send_message(line_user_id, body.message, setting.channel_access_token)
    if not ok:
        raise HTTPException(status_code=502, detail=f"LINE 送信失敗: {err}")

    # 送信メッセージを DB に保存
    if lc:
        msg = LineMessageORM(
            store_id=store_id,
            line_customer_id=lc.id,
            direction="outbound",
            message_type="text",
            content=body.message,
            sent_at=_utcnow(),
        )
        db.add(msg)
        db.commit()

    return {"status": "ok"}


@router.post("/messages/broadcast")
def broadcast(
    body: BroadcastRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    store_id = _require_store(current_user)
    _require_admin(current_user)
    setting = _get_setting(db, store_id)
    if not setting or not setting.channel_access_token:
        raise HTTPException(status_code=400, detail="LINE 設定が未完了です")

    ok, err = line_service.broadcast_message(body.message, setting.channel_access_token)
    if not ok:
        raise HTTPException(status_code=502, detail=f"LINE 一斉送信失敗: {err}")
    return {"status": "ok"}


# ============================================================
# 通知テンプレート
# ============================================================

@router.post("/notify/work-order")
def notify_work_order(
    body: NotifyWorkOrderRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """整備完了通知を LINE 送信"""
    store_id = _require_store(current_user)
    setting = _get_setting(db, store_id)
    if not setting or not setting.channel_access_token:
        raise HTTPException(status_code=400, detail="LINE 設定が未完了です")

    lc = db.execute(
        select(LineCustomerORM).where(
            LineCustomerORM.id == body.line_customer_id,
            LineCustomerORM.store_id == store_id,
        )
    ).scalar_one_or_none()
    if not lc:
        raise HTTPException(status_code=404, detail="LINE 顧客が見つかりません")

    flex = line_service.flex_work_complete(body.car_name, body.work_summary, body.total_price, body.detail_url or "/")
    ok, err = line_service.send_flex_message(lc.line_user_id, "整備完了のお知らせ", flex, setting.channel_access_token)
    if not ok:
        raise HTTPException(status_code=502, detail=f"LINE 送信失敗: {err}")

    msg = LineMessageORM(
        store_id=store_id,
        line_customer_id=lc.id,
        direction="outbound",
        message_type="text",
        content=f"[整備完了通知] {body.car_name} ¥{body.total_price:,}",
        sent_at=_utcnow(),
    )
    db.add(msg)
    db.commit()
    return {"status": "ok"}


@router.post("/notify/estimate")
def notify_estimate(
    body: NotifyEstimateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """見積送付通知を LINE 送信"""
    store_id = _require_store(current_user)
    setting = _get_setting(db, store_id)
    if not setting or not setting.channel_access_token:
        raise HTTPException(status_code=400, detail="LINE 設定が未完了です")

    lc = db.execute(
        select(LineCustomerORM).where(
            LineCustomerORM.id == body.line_customer_id,
            LineCustomerORM.store_id == store_id,
        )
    ).scalar_one_or_none()
    if not lc:
        raise HTTPException(status_code=404, detail="LINE 顧客が見つかりません")

    flex = line_service.flex_estimate(body.car_name, body.estimate_price, body.estimate_url or "/")
    ok, err = line_service.send_flex_message(lc.line_user_id, "お見積のご案内", flex, setting.channel_access_token)
    if not ok:
        raise HTTPException(status_code=502, detail=f"LINE 送信失敗: {err}")

    msg = LineMessageORM(
        store_id=store_id,
        line_customer_id=lc.id,
        direction="outbound",
        message_type="text",
        content=f"[見積送付通知] {body.car_name} ¥{body.estimate_price:,}",
        sent_at=_utcnow(),
    )
    db.add(msg)
    db.commit()
    return {"status": "ok"}
