"""add created_at updated_at to instruction_orders

Revision ID: c36b271befd8
Revises: ef347658390c
Create Date: 2026-03-03 18:58:05.400701

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c36b271befd8"
down_revision: Union[str, Sequence[str], None] = "ef347658390c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) 既存行があっても通るように nullable で追加
    op.add_column("instruction_orders", sa.Column("created_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("instruction_orders", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    # 2) NULL を埋める（既存データ対策）
    op.execute("UPDATE instruction_orders SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE instruction_orders SET updated_at = NOW() WHERE updated_at IS NULL")

    # 3) NOT NULL 化（ORMの想定に合わせる）
    op.alter_column("instruction_orders", "created_at", nullable=False)
    op.alter_column("instruction_orders", "updated_at", nullable=False)

    # 4) created_at index（ORMに index=True 相当）
    op.create_index("ix_instruction_orders_created_at", "instruction_orders", ["created_at"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_instruction_orders_created_at", table_name="instruction_orders")
    op.drop_column("instruction_orders", "updated_at")
    op.drop_column("instruction_orders", "created_at")