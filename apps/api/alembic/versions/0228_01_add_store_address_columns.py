from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0228_01"
down_revision = "83f1fb871441"
branch_labels = None
depends_on = None


def upgrade():
    # stores に不足カラムを追加（既存DBが古い想定）
    op.add_column("stores", sa.Column("postal_code", sa.String(length=32), nullable=True))
    op.add_column("stores", sa.Column("address1", sa.String(length=255), nullable=True))
    op.add_column("stores", sa.Column("address2", sa.String(length=255), nullable=True))

    # よく使うので index も（任意）
    op.create_index("ix_stores_postal_code", "stores", ["postal_code"])


def downgrade():
    op.drop_index("ix_stores_postal_code", table_name="stores")
    op.drop_column("stores", "address2")
    op.drop_column("stores", "address1")
    op.drop_column("stores", "postal_code")