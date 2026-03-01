from __future__ import annotations

import uuid
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0228_06"
down_revision = "0228_05"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1) billing_sequences が無い環境も考慮して作る（既にあれば何もしない）
    #    ※Postgres想定
    bind.execute(sa.text("""
    CREATE TABLE IF NOT EXISTS billing_sequences (
        id UUID PRIMARY KEY,
        store_id UUID NOT NULL,
        year INTEGER NOT NULL,
        kind VARCHAR(32) NOT NULL,
        next_no INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """))

    # 2) まず重複行があれば潰す（ユニーク制約を付ける前に必須）
    #    store_id/year/kind ごとに next_no が最大の1行だけ残す
    bind.execute(sa.text("""
    WITH ranked AS (
      SELECT
        ctid,
        ROW_NUMBER() OVER (
          PARTITION BY store_id, year, kind
          ORDER BY next_no DESC, updated_at DESC
        ) AS rn
      FROM billing_sequences
    )
    DELETE FROM billing_sequences
    WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
    """))

    # 3) billing_documents の最大番号に合わせて billing_sequences を補正する
    #    doc_no 末尾の 5桁を最大値として next_no を同期
    rows = bind.execute(sa.text(r"""
      SELECT
        store_id,
        EXTRACT(YEAR FROM created_at)::int AS year,
        kind,
        MAX(COALESCE(NULLIF(SUBSTRING(doc_no FROM '(\d{5})$'), ''), '0')::int) AS max_no
      FROM billing_documents
      WHERE doc_no IS NOT NULL
      GROUP BY store_id, EXTRACT(YEAR FROM created_at)::int, kind
    """)).fetchall()

    for store_id, year, kind, max_no in rows:
        # 既存があれば GREATEST で引き上げ、無ければ作成
        existing = bind.execute(
            sa.text("""
            SELECT next_no
            FROM billing_sequences
            WHERE store_id = :store_id AND year = :year AND kind = :kind
            """),
            {"store_id": store_id, "year": year, "kind": kind},
        ).scalar()

        if existing is None:
            bind.execute(
                sa.text("""
                INSERT INTO billing_sequences (id, store_id, year, kind, next_no, created_at, updated_at)
                VALUES (:id, :store_id, :year, :kind, :next_no, NOW(), NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "store_id": store_id,
                    "year": int(year),
                    "kind": kind,
                    "next_no": int(max_no or 0),
                },
            )
        else:
            bind.execute(
                sa.text("""
                UPDATE billing_sequences
                SET next_no = GREATEST(next_no, :next_no),
                    updated_at = NOW()
                WHERE store_id = :store_id AND year = :year AND kind = :kind
                """),
                {
                    "store_id": store_id,
                    "year": int(year),
                    "kind": kind,
                    "next_no": int(max_no or 0),
                },
            )

    # 4) (store_id, year, kind) をユニークにする（これが無いと採番が壊れる）
    #    既にある場合は何もしない
    bind.execute(sa.text("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'ux_billing_sequences_store_year_kind'
      ) THEN
        CREATE UNIQUE INDEX ux_billing_sequences_store_year_kind
          ON billing_sequences (store_id, year, kind);
      END IF;
    END $$;
    """))


def downgrade():
    # 既存データ破壊回避：戻さない
    pass