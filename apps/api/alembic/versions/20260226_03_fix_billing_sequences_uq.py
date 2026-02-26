"""Add unique constraint for billing_sequences(store_id, year, kind)

Revision ID: 20260226_03_seq_uq
Revises: 20260226_01a
Create Date: 2026-02-26
"""
from __future__ import annotations

from alembic import op

revision = "20260226_03_seq_uq"
down_revision = "20260226_01a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_billing_sequences_store_year_kind",
        "billing_sequences",
        ["store_id", "year", "kind"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_billing_sequences_store_year_kind",
        "billing_sequences",
        type_="unique",
    )