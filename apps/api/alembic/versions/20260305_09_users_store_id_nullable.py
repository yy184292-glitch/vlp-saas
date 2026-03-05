"""Make users.store_id nullable (required for superadmin with no store)

Superadmin accounts (role='superadmin') manage all stores and therefore
have no associated store_id. This migration ensures the column allows NULL
regardless of how the constraint was originally applied.

Revision ID: 20260305_09
Revises: 20260305_08
Create Date: 2026-03-05
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text


revision = "20260305_09"
down_revision = "20260305_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Idempotent: only drop NOT NULL if the column is currently non-nullable.
    result = conn.execute(
        text("""
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'store_id'
            LIMIT 1
        """)
    ).fetchone()

    if result and result[0] == "NO":
        conn.execute(
            text("ALTER TABLE users ALTER COLUMN store_id DROP NOT NULL")
        )

    # Also ensure superadmin user's role is correct if they were accidentally
    # inserted with a wrong role due to constraint failures in migration 08.
    # This is a belt-and-suspenders fix that does nothing if the user doesn't exist.
    conn.execute(
        text("""
            UPDATE users
            SET role = 'superadmin'
            WHERE email = 'admin@vlp-system.com'
              AND role != 'superadmin'
        """)
    )


def downgrade() -> None:
    # Re-adding NOT NULL would fail if any NULL values exist, so we skip it.
    pass
