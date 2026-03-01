from alembic import op


# revision identifiers, used by Alembic.
revision = "0228_05"
down_revision = "0228_04"
branch_labels = None
depends_on = None


def upgrade():
    # created_at / updated_at が無いDBを救う
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ")

    # 既存行がある場合にNULLを埋める（安全）
    op.execute("UPDATE customers SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE customers SET updated_at = NOW() WHERE updated_at IS NULL")

    # 以後のINSERTでNULLにならないように（モデル側が値を入れてもOK）
    op.execute("ALTER TABLE customers ALTER COLUMN created_at SET DEFAULT NOW()")
    op.execute("ALTER TABLE customers ALTER COLUMN updated_at SET DEFAULT NOW()")


def downgrade():
    # 既存データ破壊回避のため落とさない
    pass