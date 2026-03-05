"""Add name column to users table

Registration and invite flows collect the user's display name but it was
never persisted because the column was missing from the User model and table.

Revision ID: 20260305_03
Revises: 20260305_02
Create Date: 2026-03-05

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260305_03"
down_revision = "20260305_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS name VARCHAR(255)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS name"))
