"""add MarketCheck settings to valuation_settings

Revision ID: 1f3a9c2b7d10
Revises: aa5d55cd64f8
Create Date: 2026-03-03
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "1f3a9c2b7d10"
down_revision = "aa5d55cd64f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    cols = {c["name"] for c in inspector.get_columns("valuation_settings")}

    def add_if_missing(name: str, column: sa.Column) -> None:
        if name not in cols:
            op.add_column("valuation_settings", column)
            cols.add(name)

    add_if_missing("market_zip", sa.Column("market_zip", sa.String(), nullable=False, server_default="90210"))
    add_if_missing("market_radius_miles", sa.Column("market_radius_miles", sa.Integer(), nullable=False, server_default="200"))
    add_if_missing("market_miles_band", sa.Column("market_miles_band", sa.Integer(), nullable=False, server_default="10000"))
    add_if_missing("market_car_type", sa.Column("market_car_type", sa.String(), nullable=False, server_default="used"))
    add_if_missing("market_currency", sa.Column("market_currency", sa.String(), nullable=False, server_default="USD"))
    add_if_missing("market_fx_rate", sa.Column("market_fx_rate", sa.Numeric(12, 6), nullable=False, server_default="150"))

    # default provider: MARKETCHECK（既存値は保持）
    op.execute("ALTER TABLE valuation_settings ALTER COLUMN provider SET DEFAULT 'MARKETCHECK'")


def downgrade() -> None:
    # keep downgrade simple/safe
    op.execute("ALTER TABLE valuation_settings ALTER COLUMN provider SET DEFAULT 'MAT'")
    with op.batch_alter_table("valuation_settings") as batch_op:
        for col in ["market_fx_rate","market_currency","market_car_type","market_miles_band","market_radius_miles","market_zip"]:
            batch_op.drop_column(col)
