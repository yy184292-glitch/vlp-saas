"""add cars fields safely (stock_no migration)

Revision ID: c7c85725d6ef
Revises: e49dbe6dc40f
Create Date: 2026-02-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = "c7c85725d6ef"
down_revision = "e49dbe6dc40f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- stock_no: add nullable first ---
    op.add_column(
        "cars",
        sa.Column("stock_no", sa.String(length=50), nullable=True),
    )

    # --- fill existing rows ---
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE cars
        SET stock_no = 'LEGACY-' || id
        WHERE stock_no IS NULL
    """))

    # --- set NOT NULL ---
    op.alter_column(
        "cars",
        "stock_no",
        existing_type=sa.String(length=50),
        nullable=False,
    )

    # --- unique index ---
    op.create_index(
        "ix_cars_stock_no",
        "cars",
        ["stock_no"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_cars_stock_no", table_name="cars")
    op.drop_column("cars", "stock_no")