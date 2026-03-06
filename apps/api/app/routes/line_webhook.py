from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.line_customer import LineCustomerORM
from app.models.line_message import LineMessageORM
from app.models.line_setting import LineSettingORM
from app.services import line_service
from app.routes.push_notification import send_push_to_store

from fastapi import Depends

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/line", tags=["line"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_setting(db: Session, store_id_str: str) -> LineSettingORM | None:
    from uuid import UUID
    try:
        sid = UUID(store_id_str)
    except Exception:
        return None
    return db.execute(
        select(LineSettingORM).where(LineSettingORM.store_id == sid)
    ).scalar_one_or_none()


def _upsert_line_customer(
    db: Session,
    store_id,
    line_user_id: str,
    display_name: str | None = None,
    picture_url: str | None = None,
) -> LineCustomerORM:
    """LINE ユーザーを取得 or 作成する"""
    lc = db.execute(
        select(LineCustomerORM).where(
            LineCustomerORM.store_id == store_id,
            LineCustomerORM.line_user_id == line_user_id,
        )
    ).scalar_one_or_none()

    if not lc:
        lc = LineCustomerORM(
            store_id=store_id,
            line_user_id=line_user_id,
            display_name=display_name,
            picture_url=picture_url,
            follow_status="following",
            followed_at=_utcnow(),
        )
        db.add(lc)
        db.flush()
    else:
        if display_name:
            lc.display_name = display_name
        if picture_url:
            lc.picture_url = picture_url

    return lc


@router.post("/webhook")
async def line_webhook(
    request: Request,
    x_line_signature: str = Header(default=""),
    db: Session = Depends(get_db),
):
    """LINE Messaging API Webhook エンドポイント"""
    body_bytes = await request.body()

    # 店舗を特定するために store_id を query param から取得（LINE Webhook URL に ?store_id=xxx を付与）
    store_id_str = request.query_params.get("store_id", "")

    setting = _get_setting(db, store_id_str) if store_id_str else None

    # 署名検証（setting が取得できた場合のみ厳密に検証）
    if setting and setting.channel_secret:
        if not line_service.verify_signature(body_bytes, x_line_signature, setting.channel_secret):
            logger.warning(f"[LINE Webhook] 署名検証失敗 store_id={store_id_str}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        logger.warning(f"[LINE Webhook] 未設定ストア or channel_secret なし store_id={store_id_str}")

    import json
    try:
        payload = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    token = setting.channel_access_token if setting else ""
    store_id = setting.store_id if setting else None

    for event in payload.get("events", []):
        event_type = event.get("type")
        source = event.get("source", {})
        line_user_id = source.get("userId", "")

        if not line_user_id or not store_id:
            continue

        if event_type == "follow":
            # プロフィール取得
            profile = line_service.get_profile(line_user_id, token)
            display_name = profile.get("displayName") if profile else None
            picture_url = profile.get("pictureUrl") if profile else None

            lc = _upsert_line_customer(db, store_id, line_user_id, display_name, picture_url)
            lc.follow_status = "following"
            lc.followed_at = _utcnow()
            db.commit()

            # ウェルカムメッセージ送信
            if setting and setting.welcome_message and token:
                line_service.send_message(line_user_id, setting.welcome_message, token)

            # 店舗スタッフにプッシュ通知
            if store_id:
                try:
                    send_push_to_store(db, str(store_id), {
                        "title": "新しいLINE友だち",
                        "body": f"{display_name or 'ユーザー'} が友だち追加しました。",
                        "url": "/line",
                        "tag": "line-follow",
                    })
                except Exception:
                    pass

        elif event_type == "unfollow":
            lc = db.execute(
                select(LineCustomerORM).where(
                    LineCustomerORM.store_id == store_id,
                    LineCustomerORM.line_user_id == line_user_id,
                )
            ).scalar_one_or_none()
            if lc:
                lc.follow_status = "blocked"
                lc.blocked_at = _utcnow()
                db.commit()

        elif event_type == "message":
            msg = event.get("message", {})
            msg_type = msg.get("type", "other")
            content = msg.get("text") if msg_type == "text" else None
            reply_token = event.get("replyToken")

            # LINE客を取得 or 作成
            lc = _upsert_line_customer(db, store_id, line_user_id)
            db.commit()

            # メッセージを DB に保存
            line_msg = LineMessageORM(
                store_id=store_id,
                line_customer_id=lc.id,
                direction="inbound",
                message_type=msg_type if msg_type in ("text", "image", "sticker") else "other",
                content=content,
                line_message_id=msg.get("id"),
                sent_at=_utcnow(),
            )
            db.add(line_msg)
            db.commit()

            # 自動返信
            if setting and setting.auto_reply_enabled and setting.auto_reply_message and reply_token and token:
                line_service.reply_message(reply_token, setting.auto_reply_message, token)

                # 自動返信も DB に保存
                auto_reply = LineMessageORM(
                    store_id=store_id,
                    line_customer_id=lc.id,
                    direction="outbound",
                    message_type="text",
                    content=setting.auto_reply_message,
                    sent_at=_utcnow(),
                )
                db.add(auto_reply)
                db.commit()

            # 店舗スタッフにプッシュ通知
            if store_id and content:
                try:
                    send_push_to_store(db, str(store_id), {
                        "title": f"LINEメッセージ: {lc.display_name or 'ユーザー'}",
                        "body": content[:80],
                        "url": "/line",
                        "tag": "line-message",
                    })
                except Exception:
                    pass

    return {"status": "ok"}
