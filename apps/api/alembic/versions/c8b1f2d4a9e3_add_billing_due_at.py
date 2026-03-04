"""add billing due_at

Revision ID: c8b1f2d4a9e3
Revises: 446117fdb268
Create Date: 2026-03-04

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "c8b1f2d4a9e3"
down_revision = "446117fdb268"
branch_labels = None
depends_on = None


def _has_column(bind, table: str, column: str) -> bool:
    sql = sa.text(
        """
        select 1
        from information_schema.columns
        where table_name = :table
          and column_name = :column
        limit 1
        """
    )
    return bind.execute(sql, {"table": table, "column": column}).first() is not None


def upgrade() -> None:
    bind = op.get_bind()

    if not _has_column(bind, "billing_documents", "due_at"):
        op.add_column(
            "billing_documents",
            sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_billing_documents_due_at", "billing_documents", ["due_at"])

    if not _has_column(bind, "billing_documents", "due_is_manual"):
        op.add_column(
            "billing_documents",
            sa.Column("due_is_manual", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    bind = op.get_bind()

    if _has_column(bind, "billing_documents", "due_is_manual"):
        op.drop_column("billing_documents", "due_is_manual")

    if _has_column(bind, "billing_documents", "due_at"):
        # index might not exist if created manually; drop if present
        try:
            op.drop_index("ix_billing_documents_due_at", table_name="billing_documents")
        except Exception:
            pass
        op.drop_column("billing_documents", "due_at")
