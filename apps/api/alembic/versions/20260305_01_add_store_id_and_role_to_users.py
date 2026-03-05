"""Add store_id and role columns to users table

These columns were added to the User ORM model but no migration existed,
causing login to fail with 'column users.store_id does not exist'.

Revision ID: 20260305_01
Revises: 2a364c9de024
Create Date: 2026-03-05

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260305_01"
down_revision = "2a364c9de024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # role: NOT NULL with default 'admin' (existing users inherit 'admin' role)
    conn.execute(sa.text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'admin'
    """))

    # store_id: nullable UUID FK to stores.id
    # Nullable because the system dummy user (00000000-...) has no associated store.
    # All real user registrations always set store_id.
    conn.execute(sa.text("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS store_id UUID
        REFERENCES stores(id) ON DELETE CASCADE
    """))

    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_users_store_id ON users (store_id)
    """))


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("DROP INDEX IF EXISTS ix_users_store_id"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS store_id"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN IF EXISTS role"))
