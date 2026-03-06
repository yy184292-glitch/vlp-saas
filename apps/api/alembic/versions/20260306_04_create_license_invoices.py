"""create license_invoices table and add billing fields to licenses

Revision ID: 20260306_04
Revises: 20260306_03
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260306_04"
down_revision = "20260306_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # licenses テーブルに billing_cycle / next_billing_date を追加
    op.add_column(
        "licenses",
        sa.Column("billing_cycle", sa.String(16), nullable=False, server_default="monthly"),
    )
    op.add_column(
        "licenses",
        sa.Column("next_billing_date", sa.Date(), nullable=True),
    )

    # license_invoices テーブル作成
    op.create_table(
        "license_invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "license_id",
            UUID(as_uuid=True),
            sa.ForeignKey("licenses.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # INV-YYYY-NNNN
        sa.Column("invoice_number", sa.String(32), nullable=False, unique=True),
        # invoice / receipt
        sa.Column("type", sa.String(16), nullable=False, server_default="invoice"),
        # monthly / yearly
        sa.Column("billing_cycle", sa.String(16), nullable=False, server_default="monthly"),
        sa.Column("amount", sa.Integer(), nullable=False),           # 税抜金額
        sa.Column("tax_amount", sa.Integer(), nullable=False),       # 消費税額
        sa.Column("total_amount", sa.Integer(), nullable=False),     # 税込合計
        sa.Column("period_from", sa.Date(), nullable=True),
        sa.Column("period_to", sa.Date(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        # draft / issued / paid / cancelled
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("license_invoices")
    op.drop_column("licenses", "next_billing_date")
    op.drop_column("licenses", "billing_cycle")
