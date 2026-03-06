"""create sns_settings and sns_posts tables

Revision ID: 20260306_02
Revises: 20260306_01
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision = "20260306_02"
down_revision = "20260306_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sns_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),

        # Twitter
        sa.Column("twitter_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("twitter_api_key", sa.String, nullable=True),
        sa.Column("twitter_api_secret", sa.String, nullable=True),
        sa.Column("twitter_access_token", sa.String, nullable=True),
        sa.Column("twitter_access_secret", sa.String, nullable=True),

        # Instagram
        sa.Column("instagram_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("instagram_account_id", sa.String, nullable=True),
        sa.Column("instagram_access_token", sa.String, nullable=True),

        # LINE
        sa.Column("line_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("line_channel_token", sa.String, nullable=True),
        sa.Column("line_channel_secret", sa.String, nullable=True),

        # 自動投稿トリガー
        sa.Column("auto_new_arrival", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("auto_price_down", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("auto_sold_out", sa.Boolean, nullable=False, server_default="true"),

        # 投稿テンプレート
        sa.Column("new_arrival_template", sa.Text, nullable=False,
                  server_default="【新着】{car_name} {year}年式 走行{mileage}km ¥{price}\n{store_name}"),
        sa.Column("price_down_template", sa.Text, nullable=False,
                  server_default="【値下げ】{car_name} {year}年式 → ¥{price}\n{store_name}"),
        sa.Column("sold_out_template", sa.Text, nullable=False,
                  server_default="【SOLD OUT】{car_name} {year}年式\nありがとうございました！\n{store_name}"),

        # 定期再投稿
        sa.Column("repost_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("repost_interval_weeks", sa.Integer, nullable=False, server_default="2"),
        sa.Column("repost_platforms", JSON, nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_table(
        "sns_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("car_id", UUID(as_uuid=True), sa.ForeignKey("cars.id", ondelete="SET NULL"), nullable=True, index=True),

        # trigger: new_arrival / price_down / sold_out / manual / repost
        sa.Column("trigger", sa.String(50), nullable=False),
        # platform: twitter / instagram / line / all
        sa.Column("platform", sa.String(50), nullable=False, server_default="all"),
        # status: pending / posted / failed / skipped
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),

        sa.Column("caption", sa.Text, nullable=False),
        sa.Column("image_urls", JSON, nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("repost_count", sa.Integer, nullable=False, server_default="0"),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    op.create_index("ix_sns_posts_store_trigger", "sns_posts", ["store_id", "trigger"])
    op.create_index("ix_sns_posts_car_id_trigger", "sns_posts", ["car_id", "trigger"])


def downgrade() -> None:
    op.drop_table("sns_posts")
    op.drop_table("sns_settings")
