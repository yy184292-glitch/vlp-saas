"""Create work_masters and work_master_rates; drop maintenance_presets

Revision ID: 20260305_06
Revises: 20260305_05
Create Date: 2026-03-05
"""
from __future__ import annotations

import uuid as _uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260305_06"
down_revision = "20260305_05"
branch_labels = None
depends_on = None

VEHICLE_CATS = [
    "軽自動車",
    "普通乗用車小型",
    "普通乗用車中大型",
    "トラック小型2t以下",
    "トラック中型2t超3以下8t以下",
    "トラック大型8t超",
]

# (work_name, work_category, sort_order, [dur_6cats])
SEED = [
    # 軽整備
    ("エンジンオイル交換",   "軽整備",  10, [30,30,30,30,30,45]),
    ("オイルフィルター交換", "軽整備",  20, [30,30,30,30,30,45]),
    ("エアフィルター交換",   "軽整備",  30, [20,20,20,30,30,30]),
    ("ワイパー交換",         "軽整備",  40, [15,15,15,20,20,20]),
    ("バッテリー交換",       "軽整備",  50, [20,20,20,30,30,30]),
    # 足回り
    ("タイヤ交換（4本）",          "足回り", 110, [60,60,60,60,60,90]),
    ("タイヤローテーション",       "足回り", 120, [30,30,30,30,30,45]),
    ("ブレーキパッド前",           "足回り", 130, [45,60,60,60,90,90]),
    ("ブレーキパッド後",           "足回り", 140, [45,60,60,60,90,90]),
    ("ブレーキフルード交換",     "足回り", 150, [30,30,30,30,30,30]),
    ("ショックアブソーバー交換",   "足回り", 160, [120,120,120,180,180,240]),
    # 冷却系
    ("冷却水交換",        "冷却系", 210, [30,30,30,45,45,45]),
    ("ラジエーター交換",  "冷却系", 220, [90,90,90,120,120,150]),
    ("サーモスタット交換", "冷却系", 230, [60,60,60,60,60,90]),
    # 重整備
    ("インジェクター交換（1本）",    "重整備", 310, [60,60,60,90,90,90]),
    ("インジェクター交換（全気筒）",  "重整備", 320, [120,120,120,180,180,180]),
    ("ヘッドガスケット交換",      "重整備", 330, [300,300,360,360,480,480]),
    ("タイミングベルト交換",      "重整備", 340, [150,150,180,180,240,240]),
    ("タイミングチェーン交換",    "重整備", 350, [180,180,240,240,300,300]),
    ("クラッチ交換",            "重整備", 360, [180,180,240,240,300,360]),
    ("エンジンマウント交換",      "重整備", 370, [90,90,90,120,120,120]),
    ("オルタネーター交換",    "重整備", 380, [60,60,90,90,90,120]),
    ("スターター交換",          "重整備", 390, [60,60,90,90,90,120]),
    ("燃料タンク交換",          "重整備", 400, [120,120,120,180,180,240]),
    ("燃料ポンプ交換",          "重整備", 410, [90,90,90,120,120,150]),
    ("エンジンオーバーホール",    "重整備", 420, [1800,1800,2400,2400,3000,3600]),
    ("エンジン載せ替え",          "重整備", 430, [480,480,600,600,720,840]),
    ("ミッションオーバーホール",  "重整備", 440, [600,600,720,720,900,1080]),
    ("ミッション載せ替え",          "重整備", 450, [240,240,300,300,360,420]),
    ("デフオーバーホール",        "重整備", 460, [300,300,360,360,480,480]),
    ("トランスファー交換",        "重整備", 470, [180,180,240,240,300,360]),
    # 電装・カー用品
    ("カーナビ取り付け",           "電装・カー用品", 510, [120,120,120,120,120,120]),
    ("バックカメラ取り付け",         "電装・カー用品", 520, [60,60,60,60,60,60]),
    ("ドライブレコーダー取り付け",     "電装・カー用品", 530, [45,45,45,45,45,60]),
    ("ETC取り付け",                "電装・カー用品", 540, [45,45,45,45,45,60]),
    ("カーオーディオ交換",           "電装・カー用品", 550, [60,60,60,60,60,60]),
    ("HIDキット取り付け",            "電装・カー用品", 560, [60,60,60,60,60,60]),
    ("LEDヘッドライト化",              "電装・カー用品", 570, [60,60,60,90,90,90]),
    ("サブウーファー・アンプ取り付け", "電装・カー用品", 580, [120,120,120,120,120,120]),
    ("レーダー探知機取り付け",       "電装・カー用品", 590, [30,30,30,30,30,30]),
    # 故障診断
    ("OBD故障診断",          "故障診断", 610, [30,30,30,30,30,30]),
    ("エンジン警告灯診断",   "故障診断", 620, [60,60,60,60,60,60]),
    ("エアバッグ警告灯診断", "故障診断", 630, [60,60,60,60,60,60]),
    ("ABS警告灯診断",      "故障診断", 640, [60,60,60,60,60,60]),
    ("電気系統診断",     "故障診断", 650, [60,60,60,60,60,60]),
    ("圧縮圧力測定",       "故障診断", 660, [45,45,45,60,60,60]),
    ("燃料系診断",           "故障診断", 670, [60,60,60,60,60,60]),
    # 板金・外装
    ("板金（小）",             "板金・外装", 710, [120,120,120,120,120,120]),
    ("板金（中）",             "板金・外装", 720, [240,240,240,240,240,240]),
    ("板金（大）",             "板金・外装", 730, [480,480,480,480,480,480]),
    ("バンパー脱素",             "板金・外装", 740, [60,60,60,60,60,60]),
    ("ガラス交換（フロント）",  "板金・外装", 750, [120,120,120,120,120,120]),
    ("ガラス交換（サイド・リア）","板金・外装", 760, [90,90,90,90,90,90]),
    ("ルーフ修理",             "板金・外装", 770, [300,300,300,300,300,300]),
    # エアコン
    ("エアコンガス補充",     "エアコン", 810, [30,30,30,30,30,30]),
    ("エアコンフィルター交換", "エアコン", 820, [15,15,15,20,20,20]),
    ("エアコンコンプレッサー交換","エアコン", 830, [120,120,120,150,150,180]),
    ("エバポレーター洗浄",   "エアコン", 840, [60,60,60,60,60,60]),
    # 定期点検
    ("3ヶ月点検",   "定期点検", 910, [60,60,60,60,60,60]),
    ("6ヶ月点検",   "定期点検", 920, [90,90,90,90,90,90]),
    ("12ヶ月点検",  "定期点検", 930, [120,120,120,120,120,120]),
    ("車検整備一式","定期点検", 940, [180,180,180,180,180,240]),
]


def upgrade() -> None:
    op.create_table(
        "work_masters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("work_name", sa.String(255), nullable=False),
        sa.Column("work_category", sa.String(50), nullable=False),
        sa.Column("store_id", UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_table(
        "work_master_rates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("work_master_id", UUID(as_uuid=True),
            sa.ForeignKey("work_masters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("vehicle_category", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_work_master_rates_wm_vc", "work_master_rates", ["work_master_id", "vehicle_category"])

    conn = op.get_bind()
    for work_name, work_category, sort_order, durations in SEED:
        work_id = str(_uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO work_masters (id, work_name, work_category, store_id, is_active, sort_order)"
            " VALUES (:id, :wn, :wc, NULL, TRUE, :so)"
        ), {"id": work_id, "wn": work_name, "wc": work_category, "so": sort_order})
        for i, vc in enumerate(VEHICLE_CATS):
            conn.execute(sa.text(
                "INSERT INTO work_master_rates (id, work_master_id, vehicle_category, duration_minutes, price)"
                " VALUES (:id, :wm_id, :vc, :dm, NULL)"
            ), {"id": str(_uuid.uuid4()), "wm_id": work_id, "vc": vc, "dm": durations[i]})

    # Drop old maintenance_presets
    try:
        op.drop_index("ix_maintenance_presets_store_category", table_name="maintenance_presets")
    except Exception:
        pass
    try:
        op.drop_table("maintenance_presets")
    except Exception:
        pass


def downgrade() -> None:
    op.drop_index("ix_work_master_rates_wm_vc", table_name="work_master_rates")
    op.drop_table("work_master_rates")
    op.drop_table("work_masters")
