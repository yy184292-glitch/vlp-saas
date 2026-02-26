"""ensure system_settings schema and seed tax

Revision ID: 20260226_01_create_system_settings_and_seed_tax
Revises: 9c1a0a2d0f11
Create Date: 2026-02-26
"""
from __future__ import annotations

from alembic import op

# Revision identifiers, used by Alembic.
revision = "20260226_01_create_system_settings_and_seed_tax"
down_revision = "9c1a0a2d0f11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Production-safe:
    - Create system_settings if missing
    - Add missing columns if table exists with older schema
    - Seed tax settings (upsert)
    """
    op.execute(
        """
        DO $$
        BEGIN
          -- Create table if missing
          IF to_regclass('public.system_settings') IS NULL THEN
            CREATE TABLE system_settings (
              key text PRIMARY KEY,
              value jsonb NOT NULL DEFAULT '{}'::jsonb,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );
          END IF;

          -- Add missing columns safely (supports older tables)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='system_settings' AND column_name='value'
          ) THEN
            ALTER TABLE system_settings
              ADD COLUMN value jsonb NOT NULL DEFAULT '{}'::jsonb;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='system_settings' AND column_name='created_at'
          ) THEN
            ALTER TABLE system_settings
              ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='system_settings' AND column_name='updated_at'
          ) THEN
            ALTER TABLE system_settings
              ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
          END IF;

          -- Seed / upsert tax setting
          INSERT INTO system_settings(key, value)
          VALUES ('tax', '{"rate": 0.10, "mode": "exclusive", "rounding": "floor"}'::jsonb)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = now();
        END
        $$;
        """
    )


def downgrade() -> None:
    """
    Do not drop the table in production downgrade automatically.
    Keeping downgrade as no-op avoids accidental data loss.
    """
    pass