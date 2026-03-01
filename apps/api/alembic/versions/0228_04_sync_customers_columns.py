from alembic import op


# revision identifiers, used by Alembic.
revision = "0228_04"
down_revision = "0228_03"
branch_labels = None
depends_on = None


def upgrade():
    # Postgres安全版：既にあれば何もしない
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS name_kana VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS honorific VARCHAR(16)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code VARCHAR(16)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS address1 VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS address2 VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS tel VARCHAR(32)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255)")

    # デフォルト（既存行があるDBでも破綻しないように）
    op.execute("UPDATE customers SET honorific='御中' WHERE honorific IS NULL")
    op.execute("ALTER TABLE customers ALTER COLUMN honorific SET DEFAULT '御中'")


def downgrade():
    # 既存データ破壊回避のため落とさない
    pass