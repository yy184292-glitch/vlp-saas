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
    # 1) 重複があっても後続のUNIQUE追加で落ちないよう、最新をkeeperにして next_no を最大に寄せる
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
                    ORDER BY updated_at DESC NULLS LAST,
                             created_at DESC NULLS LAST,
                             id DESC
                ) AS rn,
                MAX(next_no) OVER (
                    PARTITION BY store_id, year, kind
                ) AS max_no
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

    # 2) keeper以外を削除
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY store_id, year, kind
                    ORDER BY updated_at DESC NULLS LAST,
                             created_at DESC NULLS LAST,
                             id DESC
                ) AS rn
            FROM billing_sequences
        )
        DELETE FROM billing_sequences bs
        USING ranked r
        WHERE bs.id = r.id
          AND r.rn > 1;
        """
    )

    # 3) UNIQUE制約を「存在していなければ」追加（例外握りつぶし方式だと環境によって捕まらないため）
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'uq_billing_sequences_store_year_kind'
            ) THEN
                ALTER TABLE billing_sequences
                ADD CONSTRAINT uq_billing_sequences_store_year_kind
                UNIQUE (store_id, year, kind);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE billing_sequences
        DROP CONSTRAINT IF EXISTS uq_billing_sequences_store_year_kind;
        """
    )