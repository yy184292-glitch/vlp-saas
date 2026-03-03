"""add store invoice due rule

Revision ID: 446117fdb268
Revises: 6e0a22ab8d28
Create Date: 2026-03-04

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "446117fdb268"
down_revision = "6e0a22ab8d28"
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

    # store_settings に列が無ければ追加（既にあるなら何もしない）
    if not _has_column(bind, "store_settings", "invoice_due_rule_type"):
        op.add_column(
            "store_settings",
            sa.Column(
                "invoice_due_rule_type",
                sa.String(length=10),
                nullable=False,
                server_default="days",
            ),
        )

    if not _has_column(bind, "store_settings", "invoice_due_days"):
        op.add_column(
            "store_settings",
            sa.Column(
                "invoice_due_days",
                sa.Integer(),
                nullable=False,
                server_default="30",
            ),
        )

    if not _has_column(bind, "store_settings", "invoice_due_months"):
        op.add_column(
            "store_settings",
            sa.Column(
                "invoice_due_months",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
        )


def downgrade() -> None:
    # downgrade は安全側で「存在する列だけ落とす」
    bind = op.get_bind()

    if _has_column(bind, "store_settings", "invoice_due_months"):
        op.drop_column("store_settings", "invoice_due_months")
    if _has_column(bind, "store_settings", "invoice_due_days"):
        op.drop_column("store_settings", "invoice_due_days")
    if _has_column(bind, "store_settings", "invoice_due_rule_type"):
        op.drop_column("store_settings", "invoice_due_rule_type")