"""Add expenses table

Revision ID: 20260301_01_expenses
Revises: 0228_06
Create Date: 2026-03-01

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260301_01_expenses"
down_revision = "0228_06"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(name)


def upgrade() -> None:
    if _table_exists("expenses"):
        return

    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("vendor", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("payment_method", sa.String(length=64), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_expenses_store_id", "expenses", ["store_id"])
    op.create_index("ix_expenses_expense_date", "expenses", ["expense_date"])
    op.create_index("ix_expenses_category", "expenses", ["category"])
    op.create_index("ix_expenses_title", "expenses", ["title"])
    op.create_index("ix_expenses_vendor", "expenses", ["vendor"])

    op.create_index("ix_expenses_store_date", "expenses", ["store_id", "expense_date"])
    op.create_index("ix_expenses_store_category", "expenses", ["store_id", "category"])
    op.create_index("ix_expenses_store_title", "expenses", ["store_id", "title"])


def downgrade() -> None:
    if not _table_exists("expenses"):
        return
    op.drop_index("ix_expenses_store_title", table_name="expenses")
    op.drop_index("ix_expenses_store_category", table_name="expenses")
    op.drop_index("ix_expenses_store_date", table_name="expenses")
    op.drop_index("ix_expenses_vendor", table_name="expenses")
    op.drop_index("ix_expenses_title", table_name="expenses")
    op.drop_index("ix_expenses_category", table_name="expenses")
    op.drop_index("ix_expenses_expense_date", table_name="expenses")
    op.drop_index("ix_expenses_store_id", table_name="expenses")
    op.drop_table("expenses")
