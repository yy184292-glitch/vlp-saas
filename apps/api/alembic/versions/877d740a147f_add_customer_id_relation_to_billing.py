"""add customer_id relation to billing

Revision ID: 877d740a147f
Revises: 70862169bcef
Create Date: 2026-02-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "877d740a147f"
down_revision = "70862169bcef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    NOTE:
    autogenerate が「存在するがORM未ロードの古いテーブル」を removed 扱いして drop_table を生成することがある。
    このプロジェクトではそれを実行しない（既存データ破壊 & 依存関係で失敗するため）。

    この migration は billing_documents.customer_id の “関係性（FK/Index）” のみを保証する。
    customer_id カラム自体は既に 70862169bcef で追加済み前提。
    """

    # 1) customer_id の index（無ければ作る）
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_billing_documents_customer_id
        ON billing_documents (customer_id);
        """
    )

    # 2) customer_id の外部キー（無ければ作る）
    #    ※ Postgres は ADD CONSTRAINT IF NOT EXISTS が無いので DO ブロックで回避
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_billing_documents_customer_id_customers'
            ) THEN
                ALTER TABLE billing_documents
                ADD CONSTRAINT fk_billing_documents_customer_id_customers
                FOREIGN KEY (customer_id)
                REFERENCES customers (id)
                ON DELETE SET NULL;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # 外部キー削除
    op.execute(
        """
        ALTER TABLE billing_documents
        DROP CONSTRAINT IF EXISTS fk_billing_documents_customer_id_customers;
        """
    )

    # index削除
    op.execute(
        """
        DROP INDEX IF EXISTS ix_billing_documents_customer_id;
        """
    )