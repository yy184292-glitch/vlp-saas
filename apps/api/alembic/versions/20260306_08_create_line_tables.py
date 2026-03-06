"""create LINE integration tables

Revision ID: 20260306_08
Revises: 20260306_07
Create Date: 2026-03-06
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260306_08"
down_revision = "20260306_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # line_settings
    op.create_table(
        "line_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("channel_access_token", sa.Text, nullable=True),
        sa.Column("channel_secret", sa.String(64), nullable=True),
        sa.Column("liff_id", sa.String(64), nullable=True),
        sa.Column("auto_reply_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("auto_reply_message", sa.Text, nullable=True),
        sa.Column("welcome_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_line_settings_store_id", "line_settings", ["store_id"])

    # line_customers
    op.create_table(
        "line_customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("line_user_id", sa.String(128), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=True),
        sa.Column("picture_url", sa.Text, nullable=True),
        sa.Column("follow_status", sa.String(16), nullable=False, server_default="following"),
        sa.Column("followed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_line_customers_store_id", "line_customers", ["store_id"])
    op.create_index("ix_line_customers_line_user_id", "line_customers", ["line_user_id"])
    op.create_index("ix_line_customers_customer_id", "line_customers", ["customer_id"])

    # line_messages
    op.create_table(
        "line_messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_customer_id", UUID(as_uuid=True), sa.ForeignKey("line_customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("message_type", sa.String(16), nullable=False, server_default="text"),
        sa.Column("content", sa.Text, nullable=True),
        sa.Column("line_message_id", sa.String(128), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("ix_line_messages_store_id", "line_messages", ["store_id"])
    op.create_index("ix_line_messages_line_customer_id", "line_messages", ["line_customer_id"])


def downgrade() -> None:
    op.drop_table("line_messages")
    op.drop_table("line_customers")
    op.drop_table("line_settings")
