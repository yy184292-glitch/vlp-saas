"""Add owner/new_owner columns to cars table

add_staff_and_print_settings migration defined these columns in downgrade()
but never added them in upgrade(), so the DB is missing them.
Using IF NOT EXISTS to be safe if some environments already have them.

Revision ID: 20260305_04
Revises: 20260305_03
Create Date: 2026-03-05

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260305_04"
down_revision = "20260305_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        ALTER TABLE cars
            ADD COLUMN IF NOT EXISTS owner_name          VARCHAR(255),
            ADD COLUMN IF NOT EXISTS owner_name_kana     VARCHAR(255),
            ADD COLUMN IF NOT EXISTS owner_postal_code   VARCHAR(32),
            ADD COLUMN IF NOT EXISTS owner_address1      VARCHAR(255),
            ADD COLUMN IF NOT EXISTS owner_address2      VARCHAR(255),
            ADD COLUMN IF NOT EXISTS owner_tel           VARCHAR(32),
            ADD COLUMN IF NOT EXISTS new_owner_name         VARCHAR(255),
            ADD COLUMN IF NOT EXISTS new_owner_name_kana    VARCHAR(255),
            ADD COLUMN IF NOT EXISTS new_owner_postal_code  VARCHAR(32),
            ADD COLUMN IF NOT EXISTS new_owner_address1     VARCHAR(255),
            ADD COLUMN IF NOT EXISTS new_owner_address2     VARCHAR(255),
            ADD COLUMN IF NOT EXISTS maker               VARCHAR(255)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        ALTER TABLE cars
            DROP COLUMN IF EXISTS owner_name,
            DROP COLUMN IF EXISTS owner_name_kana,
            DROP COLUMN IF EXISTS owner_postal_code,
            DROP COLUMN IF EXISTS owner_address1,
            DROP COLUMN IF EXISTS owner_address2,
            DROP COLUMN IF EXISTS owner_tel,
            DROP COLUMN IF EXISTS new_owner_name,
            DROP COLUMN IF EXISTS new_owner_name_kana,
            DROP COLUMN IF EXISTS new_owner_postal_code,
            DROP COLUMN IF EXISTS new_owner_address1,
            DROP COLUMN IF EXISTS new_owner_address2,
            DROP COLUMN IF EXISTS maker
    """))
