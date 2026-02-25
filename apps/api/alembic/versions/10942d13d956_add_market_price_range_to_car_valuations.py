"""add market price range to car_valuations

Revision ID: 10942d13d956
Revises: 7665741baba5
Create Date: 2026-02-25 14:16:36.924751

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10942d13d956'
down_revision: Union[str, Sequence[str], None] = '7665741baba5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("car_valuations", sa.Column("market_low", sa.Integer(), nullable=True))
    op.add_column("car_valuations", sa.Column("market_median", sa.Integer(), nullable=True))
    op.add_column("car_valuations", sa.Column("market_high", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("car_valuations", "market_high")
    op.drop_column("car_valuations", "market_median")
    op.drop_column("car_valuations", "market_low")