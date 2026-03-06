from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

LINE_API_BASE = "https://api.line.me/v2/bot"


# ============================================================
# 署名検証
# ============================================================

def verify_signature(body: bytes, signature: str, channel_secret: str) -> bool:
    """X-Line-Signature ヘッダーの HMAC-SHA256 署名を検証する"""
    if not channel_secret:
        return False
    expected = base64.b64encode(
        hmac.new(channel_secret.encode("utf-8"), body, hashlib.sha256).digest()
    ).decode("utf-8")
    return hmac.compare_digest(expected, signature)


# ============================================================
# メッセージ送信
# ============================================================

def _auth_header(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def send_message(line_user_id: str, message: str, token: str) -> tuple[bool, str]:
    """LINE ユーザーにテキストメッセージを送信（Push Message）"""
    if not token:
        return False, "channel_access_token が未設定です"
    try:
        resp = httpx.post(
            f"{LINE_API_BASE}/message/push",
            headers=_auth_header(token),
            json={
                "to": line_user_id,
                "messages": [{"type": "text", "text": message}],
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True, ""
        return False, f"LINE API {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


def send_flex_message(line_user_id: str, alt_text: str, flex_content: dict, token: str) -> tuple[bool, str]:
    """LINE ユーザーに Flex Message を送信"""
    if not token:
        return False, "channel_access_token が未設定です"
    try:
        resp = httpx.post(
            f"{LINE_API_BASE}/message/push",
            headers=_auth_header(token),
            json={
                "to": line_user_id,
                "messages": [{"type": "flex", "altText": alt_text, "contents": flex_content}],
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True, ""
        return False, f"LINE API {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


def reply_message(reply_token: str, message: str, token: str) -> tuple[bool, str]:
    """Reply Token を使って返信（Webhook受信時のみ有効）"""
    if not token:
        return False, "channel_access_token が未設定です"
    try:
        resp = httpx.post(
            f"{LINE_API_BASE}/message/reply",
            headers=_auth_header(token),
            json={
                "replyToken": reply_token,
                "messages": [{"type": "text", "text": message}],
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return True, ""
        return False, f"LINE API {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


def broadcast_message(message: str, token: str) -> tuple[bool, str]:
    """全友だちに一斉送信（Broadcast Message）"""
    if not token:
        return False, "channel_access_token が未設定です"
    try:
        resp = httpx.post(
            f"{LINE_API_BASE}/message/broadcast",
            headers=_auth_header(token),
            json={"messages": [{"type": "text", "text": message}]},
            timeout=10,
        )
        if resp.status_code == 200:
            return True, ""
        return False, f"LINE API {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        return False, str(e)


def get_profile(line_user_id: str, token: str) -> dict | None:
    """LINE プロフィール取得（displayName, pictureUrl）"""
    if not token:
        return None
    try:
        resp = httpx.get(
            f"{LINE_API_BASE}/profile/{line_user_id}",
            headers=_auth_header(token),
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


# ============================================================
# Flex Message テンプレート
# ============================================================

def flex_work_complete(car_name: str, work_summary: str, total_price: int, detail_url: str) -> dict:
    """整備完了通知 Flex Message"""
    return {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#10b981",
            "contents": [
                {"type": "text", "text": "整備完了のお知らせ", "color": "#ffffff", "weight": "bold", "size": "md"}
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": car_name, "weight": "bold", "size": "lg", "wrap": True},
                {"type": "text", "text": work_summary, "size": "sm", "color": "#555555", "wrap": True},
                {
                    "type": "box",
                    "layout": "horizontal",
                    "margin": "md",
                    "contents": [
                        {"type": "text", "text": "合計金額", "size": "sm", "color": "#555555", "flex": 1},
                        {"type": "text", "text": f"¥{total_price:,}", "size": "sm", "color": "#111111", "weight": "bold", "align": "end", "flex": 1},
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#10b981",
                    "action": {"type": "uri", "label": "詳細を見る", "uri": detail_url},
                }
            ],
        },
    }


def flex_estimate(car_name: str, estimate_price: int, estimate_url: str) -> dict:
    """見積送付通知 Flex Message"""
    return {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#3b82f6",
            "contents": [
                {"type": "text", "text": "お見積のご案内", "color": "#ffffff", "weight": "bold", "size": "md"}
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": car_name, "weight": "bold", "size": "lg", "wrap": True},
                {
                    "type": "box",
                    "layout": "horizontal",
                    "margin": "md",
                    "contents": [
                        {"type": "text", "text": "見積金額", "size": "sm", "color": "#555555", "flex": 1},
                        {"type": "text", "text": f"¥{estimate_price:,}", "size": "sm", "color": "#111111", "weight": "bold", "align": "end", "flex": 1},
                    ],
                },
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#3b82f6",
                    "action": {"type": "uri", "label": "見積を確認する", "uri": estimate_url},
                }
            ],
        },
    }


def flex_checkin(received_at: str, staff_name: str, status_url: str) -> dict:
    """入庫受付通知 Flex Message"""
    return {
        "type": "bubble",
        "header": {
            "type": "box",
            "layout": "vertical",
            "backgroundColor": "#f59e0b",
            "contents": [
                {"type": "text", "text": "入庫受付完了", "color": "#ffffff", "weight": "bold", "size": "md"}
            ],
        },
        "body": {
            "type": "box",
            "layout": "vertical",
            "spacing": "sm",
            "contents": [
                {"type": "text", "text": f"受付日時: {received_at}", "size": "sm", "color": "#555555"},
                {"type": "text", "text": f"担当: {staff_name}", "size": "sm", "color": "#555555"},
            ],
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "style": "primary",
                    "color": "#f59e0b",
                    "action": {"type": "uri", "label": "作業状況を確認する", "uri": status_url},
                }
            ],
        },
    }
