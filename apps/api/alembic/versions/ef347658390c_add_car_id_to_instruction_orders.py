"""add car_id to instruction_orders

Revision ID: ef347658390c
Revises: 95d40eebfa12
Create Date: 2026-03-03 18:40:46.830804

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ef347658390c"
down_revision: Union[str, Sequence[str], None] = "95d40eebfa12"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) instruction_orders.car_id を追加（NULL許容）
    op.add_column(
        "instruction_orders",
        sa.Column("car_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 2) index（JOIN/検索のため）
    op.create_index(
        "ix_instruction_orders_car_id",
        "instruction_orders",
        ["car_id"],
        unique=False,
    )

    # 3) FK（cars.id へ。削除時は NULL）
    op.create_foreign_key(
        "instruction_orders_car_id_fkey",
        source_table="instruction_orders",
        referent_table="cars",
        local_cols=["car_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("instruction_orders_car_id_fkey", "instruction_orders", type_="foreignkey")
    op.drop_index("ix_instruction_orders_car_id", table_name="instruction_orders")
    op.drop_column("instruction_orders", "car_id")