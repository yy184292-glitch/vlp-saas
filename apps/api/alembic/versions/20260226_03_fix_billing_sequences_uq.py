@'
"""Fix billing_sequences duplicates then add UNIQUE(store_id, year, kind)

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
    # 1) 既に重複している (store_id, year, kind) を解消
    #    - 同一キーの複数行がある場合、next_no は最大値を残す
    #    - 残す行は updated_at/created_at が新しいものを優先
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                store_id,
                year,
                kind,
                next_no,
                created_at,
                updated_at,
                ROW_NUMBER() OVER (
                    PARTITION BY store_id, year, kind
                    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                ) AS rn,
                MAX(next_no) OVER (PARTITION BY store_id, year, kind) AS max_no
            FROM billing_sequences
        ),
        keepers AS (
            SELECT id, max_no
            FROM ranked
            WHERE rn = 1
        )
        UPDATE billing_sequences bs
        SET next_no = k.max_no
        FROM keepers k
        WHERE bs.id = k.id;
        """
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY store_id, year, kind
                    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM billing_sequences
        )
        DELETE FROM billing_sequences bs
        USING ranked r
        WHERE bs.id = r.id
          AND r.rn > 1;
        """
    )

    # 2) UNIQUE 制約を追加（すでに存在する場合は無視）
    #    Postgres は ADD CONSTRAINT IF NOT EXISTS が無い版もあるので DO ブロックで握りつぶす
    op.execute(
        """
        DO $$
        BEGIN
            ALTER TABLE billing_sequences
            ADD CONSTRAINT uq_billing_sequences_store_year_kind
            UNIQUE (store_id, year, kind);
        EXCEPTION
            WHEN duplicate_object THEN
                -- constraint already exists
                NULL;
        END $$;
        """
    )


def downgrade() -> None:
    # 制約が無い場合も落ちないように IF EXISTS
    op.execute(
        """
        ALTER TABLE billing_sequences
        DROP CONSTRAINT IF EXISTS uq_billing_sequences_store_year_kind;
        """
    )
'@ | Set-Content -Encoding UTF8 -NoNewline alembic/versions/20260226_03_fix_billing_sequences_uq.py