from alembic import op


# revision identifiers, used by Alembic.
revision = "0228_03"
down_revision = "0228_02"
branch_labels = None
depends_on = None


def upgrade():
    op.execute('ALTER TABLE customers ADD COLUMN IF NOT EXISTS name_kana VARCHAR(255)')
    op.execute('ALTER TABLE customers ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(32)')


def downgrade():
    # 既存データ破壊回避のため落とさない
    pass