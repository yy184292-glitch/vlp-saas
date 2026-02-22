"""add shaken fields safely"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d8eea3e78772"
down_revision = "aa5d55cd64f8"
branch_labels = None
depends_on = None


def upgrade():
    # Postgres専用：既にあるカラムは無視して進む
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS vin VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS model_code VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS first_registration VARCHAR')

    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS engine_displacement VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS fuel_type VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS color VARCHAR')

    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS owner_name VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS user_name VARCHAR')

    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS shaken_expiry VARCHAR')
    op.execute('ALTER TABLE cars ADD COLUMN IF NOT EXISTS mileage INTEGER')


def downgrade():
    # downgrade は安全のため「存在する場合のみ」にしたいが、
    # PostgresのDROP COLUMN IF EXISTSで冪等化
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS mileage')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS shaken_expiry')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS user_name')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS owner_name')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS color')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS fuel_type')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS engine_displacement')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS first_registration')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS model_code')
    op.execute('ALTER TABLE cars DROP COLUMN IF EXISTS vin')
