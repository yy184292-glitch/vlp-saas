"""Add prefecture column to stores table

The registration form sends prefecture (required field) but it was never
persisted because neither the ORM model nor the DB table had the column.

Revision ID: 20260305_02
Revises: 20260305_01
Create Date: 2026-03-05

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260305_02"
down_revision = "20260305_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        ALTER TABLE stores
        ADD COLUMN IF NOT EXISTS prefecture VARCHAR(32)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE stores DROP COLUMN IF EXISTS prefecture"))
