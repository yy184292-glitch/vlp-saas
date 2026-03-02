"""calendar and export

Revision ID: 20260302_01_calendar_export
Revises: 20260301_01_expenses
Create Date: 2026-03-02

"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "20260302_01_calendar_export"
down_revision = "20260301_01_expenses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # store_settings: instruction_due_days
    op.execute(
        """
        ALTER TABLE store_settings
        ADD COLUMN IF NOT EXISTS instruction_due_days INTEGER NOT NULL DEFAULT 7;
        """
    )

    # cars: export fields
    op.execute(
        """
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS export_enabled BOOLEAN NOT NULL DEFAULT FALSE;
        """
    )
    op.execute(
        """
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS export_price INTEGER;
        """
    )
    op.execute(
        """
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS export_status TEXT;
        """
    )
    op.execute(
        """
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS export_image_url TEXT;
        """
    )
    op.execute(
        """
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS export_description TEXT;
        """
    )

    # instruction_orders
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS instruction_orders (
            id UUID PRIMARY KEY,
            store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
            car_id UUID NULL REFERENCES cars(id) ON DELETE SET NULL,
            received_at TIMESTAMPTZ NOT NULL,
            due_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'in_progress',
            memo TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_instruction_orders_store_due ON instruction_orders (store_id, due_at);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_instruction_orders_store_received ON instruction_orders (store_id, received_at);")


def downgrade() -> None:
    # 安全のため、downgrade は破壊的になるので最小限
    op.execute("DROP TABLE IF EXISTS instruction_orders;")
    # カラム削除は運用で危険なため省略（必要なら明示的に作業）
