from __future__ import annotations

import json
import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.dependencies.request_user import attach_current_user, get_current_user
from app.models.push_subscription import PushSubscriptionORM

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/push",
    tags=["push"],
    dependencies=[Depends(attach_current_user)],
)


# ============================================================
# Pydantic スキーマ
# ============================================================

class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class PushSendRequest(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/"
    tag: Optional[str] = "vlp-notification"
    store_id: Optional[str] = None  # 特定店舗のみ送信（None = 全員）


# ============================================================
# VAPID ヘルパー
# ============================================================

def _get_webpush():
    """pywebpush が未インストールの場合は None を返す（グレースフルデグラデーション）"""
    try:
        from pywebpush import webpush, WebPushException
        return webpush, WebPushException
    except ImportError:
        return None, None


def _vapid_claims() -> dict:
    email = os.getenv("VAPID_EMAIL", "mailto:admin@example.com")
    return {"sub": email}


def _send_push(subscription: PushSubscriptionORM, payload: dict) -> bool:
    """1つの購読先にプッシュ通知を送信。失敗した場合は False を返す。"""
    webpush_fn, WebPushException = _get_webpush()
    if webpush_fn is None:
        logger.warning("[Push] pywebpush not installed. Skipping notification.")
        return False

    private_key = os.getenv("VAPID_PRIVATE_KEY", "")
    if not private_key:
        logger.warning("[Push] VAPID_PRIVATE_KEY not set. Skipping notification.")
        return False

    try:
        webpush_fn(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=private_key,
            vapid_claims=_vapid_claims(),
        )
        return True
    except WebPushException as ex:
        logger.error(f"[Push] WebPushException: {ex}")
        # 410 Gone = 購読が無効（削除済み）
        if ex.response and ex.response.status_code == 410:
            return None  # type: ignore  # 呼び出し元で削除
        return False
    except Exception as ex:
        logger.error(f"[Push] Unexpected error: {ex}")
        return False


# ============================================================
# ユーティリティ（他ルートから呼び出し可能）
# ============================================================

def send_push_to_store(db: Session, store_id: str, payload: dict) -> int:
    """指定店舗の全購読者にプッシュ通知を送信。成功件数を返す。"""
    subs = db.execute(
        select(PushSubscriptionORM).where(PushSubscriptionORM.store_id == store_id)
    ).scalars().all()

    sent = 0
    to_delete = []
    for sub in subs:
        result = _send_push(sub, payload)
        if result is True:
            sent += 1
        elif result is None:
            to_delete.append(sub.id)

    # 無効な購読を削除
    for sub_id in to_delete:
        db.execute(delete(PushSubscriptionORM).where(PushSubscriptionORM.id == sub_id))
    if to_delete:
        db.commit()

    return sent


# ============================================================
# エンドポイント
# ============================================================

@router.post("/subscribe", status_code=201)
def subscribe(
    body: PushSubscribeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """プッシュ通知購読を登録（既存 endpoint は upsert）"""
    existing = db.execute(
        select(PushSubscriptionORM).where(PushSubscriptionORM.endpoint == body.endpoint)
    ).scalar_one_or_none()

    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
        existing.user_agent = body.user_agent
    else:
        sub = PushSubscriptionORM(
            user_id=current_user.id,
            store_id=current_user.store_id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
            user_agent=body.user_agent,
        )
        db.add(sub)

    db.commit()
    return {"status": "ok"}


@router.delete("/unsubscribe")
def unsubscribe(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """購読解除"""
    db.execute(
        delete(PushSubscriptionORM).where(
            PushSubscriptionORM.endpoint == endpoint,
            PushSubscriptionORM.user_id == current_user.id,
        )
    )
    db.commit()
    return {"status": "ok"}


@router.post("/send")
def send_notification(
    body: PushSendRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """管理者テスト用: 通知を送信"""
    if current_user.role not in ("admin", "manager", "superadmin"):
        raise HTTPException(status_code=403, detail="管理者権限が必要です")

    payload = {"title": body.title, "body": body.body, "url": body.url, "tag": body.tag}

    if body.store_id:
        sent = send_push_to_store(db, body.store_id, payload)
    else:
        # 自店舗全員に送信
        if not current_user.store_id:
            raise HTTPException(status_code=400, detail="store_id が必要です")
        sent = send_push_to_store(db, str(current_user.store_id), payload)

    return {"status": "ok", "sent": sent}
