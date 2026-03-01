"""Add store settings, master categories, expense attachments, expense sources

Revision ID: 3c1a9c2f7b21
Revises: 69b3f489ef79
Create Date: 2026-03-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "3c1a9c2f7b21"
down_revision = "69b3f489ef79"
branch_labels = None
depends_on = None


def upgrade():
    # store_settings
    op.create_table(
        "store_settings",
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tax_rate", sa.Numeric(5, 4), nullable=False, server_default="0.10"),
        sa.Column("auto_expense_on_stock_in", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_store_settings_store_id", "store_settings", ["store_id"])

    # expense_categories
    op.create_table(
        "expense_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_expense_categories_store_id", "expense_categories", ["store_id"])
    op.create_index("ux_expense_categories_store_name", "expense_categories", ["store_id", "name"], unique=True)

    # work_categories
    op.create_table(
        "work_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_work_categories_store_id", "work_categories", ["store_id"])
    op.create_index("ux_work_categories_store_name", "work_categories", ["store_id", "name"], unique=True)

    # expense_sources
    op.create_table(
        "expense_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expense_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_expense_sources_store", "expense_sources", ["store_id"])
    op.create_index("ix_expense_sources_expense", "expense_sources", ["expense_id"])
    op.create_index("ux_expense_sources_type_id", "expense_sources", ["source_type", "source_id"], unique=True)

    # expense_attachments
    op.create_table(
        "expense_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expense_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("storage_path", sa.String(length=512), nullable=False),
        sa.Column("size_bytes", sa.String(length=32), nullable=True),
        sa.Column("ocr_text", sa.Text(), nullable=True),
        sa.Column("ocr_lang", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_expense_attachments_store_id", "expense_attachments", ["store_id"])
    op.create_index("ix_expense_attachments_expense_id", "expense_attachments", ["expense_id"])
    op.create_index("ix_exp_attach_store_expense", "expense_attachments", ["store_id", "expense_id"])

    # seed: 店舗ごとの設定/カテゴリは、アプリ起動後にAPIでlazy作成（シンプル運用）


def downgrade():
    op.drop_index("ix_exp_attach_store_expense", table_name="expense_attachments")
    op.drop_index("ix_expense_attachments_expense_id", table_name="expense_attachments")
    op.drop_index("ix_expense_attachments_store_id", table_name="expense_attachments")
    op.drop_table("expense_attachments")

    op.drop_index("ux_expense_sources_type_id", table_name="expense_sources")
    op.drop_index("ix_expense_sources_expense", table_name="expense_sources")
    op.drop_index("ix_expense_sources_store", table_name="expense_sources")
    op.drop_table("expense_sources")

    op.drop_index("ux_work_categories_store_name", table_name="work_categories")
    op.drop_index("ix_work_categories_store_id", table_name="work_categories")
    op.drop_table("work_categories")

    op.drop_index("ux_expense_categories_store_name", table_name="expense_categories")
    op.drop_index("ix_expense_categories_store_id", table_name="expense_categories")
    op.drop_table("expense_categories")

    op.drop_index("ix_store_settings_store_id", table_name="store_settings")
    op.drop_table("store_settings")
