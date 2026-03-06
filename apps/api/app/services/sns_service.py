"""SNS投稿サービス

各SNSへの投稿はHTTPSリクエストで実装（SDK不要）。
Twitter: OAuth 1.0a 手動署名 + v2 API
Instagram: Graph API (メディアコンテナ作成→公開)
LINE: Messaging API broadcast
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ─── テンプレート変数展開 ────────────────────────────────────

def generate_caption(
    car_data: Dict,
    trigger: str,
    template: str,
    store_name: str = "",
) -> str:
    """
    テンプレート変数を展開して投稿文を生成する。

    変数: {car_name}, {year}, {mileage}, {price}, {store_name},
          {color}, {inspection}, {comment}
    """
    make = car_data.get("make") or ""
    model = car_data.get("model") or ""
    grade = car_data.get("grade") or ""
    car_name = " ".join(filter(None, [make, model, grade])).strip() or "車両"

    year = car_data.get("year")
    year_str = f"{year}" if year else "-"

    mileage = car_data.get("mileage")
    mileage_str = f"{mileage:,}" if isinstance(mileage, int) else "-"

    price = car_data.get("expected_sell_price")
    price_str = f"{price:,}" if isinstance(price, int) else "-"

    color = car_data.get("color") or "-"
    comment = car_data.get("export_description") or ""

    variables = {
        "car_name": car_name,
        "year": year_str,
        "mileage": mileage_str,
        "price": price_str,
        "store_name": store_name,
        "color": color,
        "inspection": "-",
        "comment": comment,
    }

    try:
        return template.format(**variables)
    except KeyError as e:
        logger.warning("Caption template has unknown variable: %s", e)
        return template


# ─── Twitter OAuth 1.0a 署名 ─────────────────────────────────

def _oauth1_header(
    method: str,
    url: str,
    api_key: str,
    api_secret: str,
    access_token: str,
    access_secret: str,
    extra_params: Optional[Dict[str, str]] = None,
) -> str:
    """RFC5849 OAuth 1.0a Authorization ヘッダーを生成する"""
    oauth_params: Dict[str, str] = {
        "oauth_consumer_key": api_key,
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }

    all_params = {**oauth_params, **(extra_params or {})}

    # パラメータをソートして base string を作る
    sorted_params = "&".join(
        f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='')}"
        for k, v in sorted(all_params.items())
    )
    base_string = "&".join([
        method.upper(),
        urllib.parse.quote(url, safe=""),
        urllib.parse.quote(sorted_params, safe=""),
    ])

    signing_key = f"{urllib.parse.quote(api_secret, safe='')}&{urllib.parse.quote(access_secret, safe='')}"
    hashed = hmac.new(signing_key.encode("utf-8"), base_string.encode("utf-8"), hashlib.sha1)
    signature = base64.b64encode(hashed.digest()).decode("utf-8")

    oauth_params["oauth_signature"] = signature
    header_value = "OAuth " + ", ".join(
        f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(v, safe="")}"'
        for k, v in sorted(oauth_params.items())
    )
    return header_value


# ─── Twitter 投稿 ────────────────────────────────────────────

async def post_to_twitter(
    caption: str,
    image_urls: Optional[List[str]],
    api_key: str,
    api_secret: str,
    access_token: str,
    access_secret: str,
) -> Tuple[bool, Optional[str]]:
    """
    Twitter v2 API でツイートを作成する。
    画像は media_ids が必要だが、URLのみの場合はテキストに含める。
    Returns (success, error_message)
    """
    tweet_url = "https://api.twitter.com/2/tweets"

    text = caption
    if image_urls:
        text += "\n" + " ".join(image_urls[:4])

    body = {"text": text[:280]}

    auth_header = _oauth1_header(
        method="POST",
        url=tweet_url,
        api_key=api_key,
        api_secret=api_secret,
        access_token=access_token,
        access_secret=access_secret,
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                tweet_url,
                json=body,
                headers={
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code in (200, 201):
            return True, None
        return False, f"Twitter API error {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, f"Twitter request failed: {e}"


# ─── Instagram 投稿 ──────────────────────────────────────────

async def post_to_instagram(
    caption: str,
    image_urls: Optional[List[str]],
    account_id: str,
    access_token: str,
) -> Tuple[bool, Optional[str]]:
    """
    Instagram Graph API でフィード投稿する（画像1枚）。
    画像がない場合はスキップ（Instagram はメディア必須）。
    Returns (success, error_message)
    """
    if not image_urls:
        return False, "Instagram投稿には画像URLが必要です"

    image_url = image_urls[0]
    base = f"https://graph.facebook.com/v18.0/{account_id}"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # Step 1: メディアコンテナ作成
            r1 = await client.post(
                f"{base}/media",
                params={
                    "image_url": image_url,
                    "caption": caption[:2200],
                    "access_token": access_token,
                },
            )
            if r1.status_code != 200:
                return False, f"IG media create error {r1.status_code}: {r1.text[:200]}"

            creation_id = r1.json().get("id")
            if not creation_id:
                return False, "IG media create: no id returned"

            # Step 2: 公開
            r2 = await client.post(
                f"{base}/media_publish",
                params={
                    "creation_id": creation_id,
                    "access_token": access_token,
                },
            )
            if r2.status_code != 200:
                return False, f"IG publish error {r2.status_code}: {r2.text[:200]}"

        return True, None
    except Exception as e:
        return False, f"Instagram request failed: {e}"


# ─── LINE 投稿 ───────────────────────────────────────────────

async def post_to_line(
    caption: str,
    image_urls: Optional[List[str]],
    channel_token: str,
) -> Tuple[bool, Optional[str]]:
    """
    LINE Messaging API broadcast でメッセージを送信する。
    Returns (success, error_message)
    """
    messages = [{"type": "text", "text": caption[:5000]}]

    if image_urls:
        messages.append({
            "type": "image",
            "originalContentUrl": image_urls[0],
            "previewImageUrl": image_urls[0],
        })

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.line.me/v2/bot/message/broadcast",
                headers={
                    "Authorization": f"Bearer {channel_token}",
                    "Content-Type": "application/json",
                },
                json={"messages": messages},
            )
        if resp.status_code == 200:
            return True, None
        return False, f"LINE API error {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, f"LINE request failed: {e}"


# ─── 統合実行 ────────────────────────────────────────────────

async def execute_sns_post(
    caption: str,
    image_urls: Optional[List[str]],
    platform: str,
    setting,  # SnsSettingORM
) -> Tuple[bool, Optional[str]]:
    """
    指定プラットフォームへ投稿する。
    platform: "twitter" | "instagram" | "line" | "all"
    Returns (success, combined_error)
    """
    errors: List[str] = []
    success_count = 0

    targets = (
        ["twitter", "instagram", "line"]
        if platform == "all"
        else [platform]
    )

    for t in targets:
        if t == "twitter" and setting.twitter_enabled:
            ok, err = await post_to_twitter(
                caption, image_urls,
                setting.twitter_api_key or "",
                setting.twitter_api_secret or "",
                setting.twitter_access_token or "",
                setting.twitter_access_secret or "",
            )
            if ok:
                success_count += 1
            else:
                errors.append(f"Twitter: {err}")

        elif t == "instagram" and setting.instagram_enabled:
            ok, err = await post_to_instagram(
                caption, image_urls,
                setting.instagram_account_id or "",
                setting.instagram_access_token or "",
            )
            if ok:
                success_count += 1
            else:
                errors.append(f"Instagram: {err}")

        elif t == "line" and setting.line_enabled:
            ok, err = await post_to_line(
                caption, image_urls,
                setting.line_channel_token or "",
            )
            if ok:
                success_count += 1
            else:
                errors.append(f"LINE: {err}")

    if errors and success_count == 0:
        return False, "; ".join(errors)
    return True, "; ".join(errors) if errors else None


# ─── 再投稿スケジュール計算 ──────────────────────────────────

def get_repost_due_cars(
    db,
    store_id,
    interval_weeks: int,
) -> List[Dict]:
    """
    new_arrival で posted かつ ステータスが販売中の車両で
    最終投稿から interval_weeks 週以上経過しているものを返す。
    """
    from sqlalchemy import select, func, and_
    from app.models.sns_post import SnsPostORM
    from app.models.car import Car

    SOLD_STATUSES = {"売約", "売約済み", "SOLD", "sold_out", "納車済"}
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(weeks=interval_weeks)

    # car_id ごとの最終投稿日を集計
    subq = (
        select(
            SnsPostORM.car_id,
            func.max(SnsPostORM.posted_at).label("last_posted_at"),
        )
        .where(
            and_(
                SnsPostORM.store_id == store_id,
                SnsPostORM.trigger.in_(["new_arrival", "repost"]),
                SnsPostORM.status == "posted",
                SnsPostORM.car_id.isnot(None),
            )
        )
        .group_by(SnsPostORM.car_id)
        .subquery()
    )

    rows = db.execute(
        select(Car, subq.c.last_posted_at)
        .join(subq, Car.id == subq.c.car_id)
        .where(
            and_(
                Car.store_id == store_id,
                subq.c.last_posted_at <= threshold,
            )
        )
    ).all()

    result = []
    for car, last_posted_at in rows:
        if car.status in SOLD_STATUSES:
            continue
        next_repost_at = last_posted_at + timedelta(weeks=interval_weeks)
        result.append({
            "car_id": car.id,
            "car": car,
            "car_name": " ".join(filter(None, [car.make, car.model, car.grade])) or "車両",
            "last_posted_at": last_posted_at,
            "next_repost_at": next_repost_at,
            "overdue": now >= next_repost_at,
        })

    return result
