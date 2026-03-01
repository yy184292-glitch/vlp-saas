"""add customer_id to billing_documents

Revision ID: 70862169bcef
Revises: 20260227_01_master
Create Date: 2026-02-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# ★ここを生成された値に合わせてください
revision = "70862169bcef"
down_revision = "20260227_01_master"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 既存DBでも安全に通るよう IF NOT EXISTS 相当の作りにする
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name='billing_documents'
                  AND column_name='customer_id'
            ) THEN
                ALTER TABLE billing_documents
                    ADD COLUMN customer_id uuid NULL;
            END IF;
        END $$;
        """
    )

    # FK（customers が存在する前提。既にあるはず）
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_billing_documents_customer_id'
            ) THEN
                ALTER TABLE billing_documents
                    ADD CONSTRAINT fk_billing_documents_customer_id
                    FOREIGN KEY (customer_id)
                    REFERENCES customers(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )

    # index
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE tablename='billing_documents'
                  AND indexname='ix_billing_documents_customer_id'
            ) THEN
                CREATE INDEX ix_billing_documents_customer_id
                    ON billing_documents(customer_id);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # index
    op.execute("DROP INDEX IF EXISTS ix_billing_documents_customer_id;")
    # fk
    op.execute("ALTER TABLE billing_documents DROP CONSTRAINT IF EXISTS fk_billing_documents_customer_id;")
    # column
    op.execute("ALTER TABLE billing_documents DROP COLUMN IF EXISTS customer_id;")