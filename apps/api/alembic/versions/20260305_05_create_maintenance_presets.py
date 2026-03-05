"""Create maintenance_presets table and seed default work-time data

Vehicle categories:
  軽自動車 / 普通小型 / 普通中大型 /
  トラック小型（2t以下）/ トラック中型（2t超8t以下）/ トラック大型（8t超）

Revision ID: 20260305_05
Revises: 20260305_04
Create Date: 2026-03-05

"""
from __future__ import annotations

import uuid as _uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "20260305_05"
down_revision = "20260305_04"
branch_labels = None
depends_on = None


CATEGORIES = [
    "軽自動車",
    "普通小型",
    "普通中大型",
    "トラック小型（2t以下）",
    "トラック中型（2t超8t以下）",
    "トラック大型（8t超）",
]

# (作業名, [軽, 普通小型, 普通中大型, トラック小型, トラック中型, トラック大型]) 単位:分
WORK_ITEMS = [
    ("エンジンオイル交換",          [30,  30,  40,  40,  60,  90]),
    ("オイルフィルター交換",         [15,  15,  20,  20,  30,  45]),
    ("エアクリーナー交換",           [15,  15,  20,  20,  30,  40]),
    ("タイヤ交換（4本）",            [60,  60,  90,  90, 120, 180]),
    ("タイヤ交換（1本）",            [20,  20,  30,  30,  40,  60]),
    ("ブレーキパッド交換（前）",      [45,  60,  90,  90, 120, 150]),
    ("ブレーキパッド交換（後）",      [45,  60,  90,  90, 120, 150]),
    ("ブレーキディスク交換（前）",    [60,  90, 120, 120, 180, 240]),
    ("バッテリー交換",               [20,  20,  30,  30,  45,  60]),
    ("スパークプラグ交換",           [30,  30,  60,  60,  90, 120]),
    ("タイミングベルト交換",         [120, 180, 240, 270, 360, 480]),
    ("Vベルト交換",                  [60,  90, 120, 120, 180, 240]),
    ("クーラント交換",               [30,  30,  45,  45,  60,  90]),
    ("ATF交換",                      [45,  60,  90,  90, 120, 150]),
    ("CVTフルード交換",              [45,  60,  90,  90, 120, 150]),
    ("ブレーキフルード交換",         [30,  30,  45,  45,  60,  90]),
    ("エアコンフィルター交換",       [15,  15,  20,  20,  30,  40]),
    ("ワイパーブレード交換",         [15,  15,  15,  20,  30,  40]),
    ("法定12ヶ月点検",               [60,  60,  90,  90, 120, 180]),
    ("法定24ヶ月点検（車検整備）",   [120, 120, 180, 180, 240, 360]),
    ("下回り防錆処理",               [60,  90, 120, 120, 180, 240]),
]


def upgrade() -> None:
    op.create_table(
        "maintenance_presets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "store_id", UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=True, index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("vehicle_category", sa.String(50), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("labor_price", sa.Integer(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_maintenance_presets_store_category",
        "maintenance_presets", ["store_id", "vehicle_category"],
    )

    # シードデータ: store_id=NULL のシステム共通デフォルト
    conn = op.get_bind()
    sort_order = 0
    for name, times in WORK_ITEMS:
        for cat_idx, category in enumerate(CATEGORIES):
            conn.execute(sa.text("""
                INSERT INTO maintenance_presets
                    (id, store_id, name, vehicle_category, duration_minutes,
                     labor_price, is_default, sort_order)
                VALUES
                    (:id, NULL, :name, :category, :duration,
                     NULL, TRUE, :sort_order)
            """), {
                "id": str(_uuid.uuid4()),
                "name": name,
                "category": category,
                "duration": times[cat_idx],
                "sort_order": sort_order,
            })
            sort_order += 1


def downgrade() -> None:
    op.drop_index("ix_maintenance_presets_store_category", table_name="maintenance_presets")
    op.drop_table("maintenance_presets")
