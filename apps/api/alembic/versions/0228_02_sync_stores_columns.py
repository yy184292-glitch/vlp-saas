from alembic import op


# revision identifiers, used by Alembic.
revision = "0228_02"
down_revision = "0228_01"
branch_labels = None
depends_on = None


def upgrade():
    # Postgres: IF NOT EXISTS で「既にある場合は何もしない」= 安全
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS tel VARCHAR(64)')
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS email VARCHAR(255)')

    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32)')

    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255)')
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255)')
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_account_type VARCHAR(32)')
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(64)')
    op.execute('ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255)')


def downgrade():
    # downgrade は安全のため基本は落とさない（既存DBの互換性を壊しやすい）
    # 必要なら手動でDROPする方が安全
    pass