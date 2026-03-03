"""fix instruction_orders store_id type uuid

Revision ID: 6e0a22ab8d28
Revises: c36b271befd8
Create Date: 2026-03-03 19:14:06.747589

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6e0a22ab8d28"
down_revision: Union[str, Sequence[str], None] = "c36b271befd8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    instruction_orders.store_id が古いスキーマで integer のまま残っているケースがあるため、
    UUID に揃える。integer -> uuid は変換不能なので既存値は NULL に落とす（安全優先）。
    """

    # 既存 index / FK があると型変更で邪魔になるので、存在すれば落とす
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_due")
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_received")
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_id")
    op.execute("ALTER TABLE instruction_orders DROP CONSTRAINT IF EXISTS instruction_orders_store_id_fkey")

    # integer -> uuid はキャストできないので NULL に落として型だけ UUID に揃える
    op.execute(
        """
        ALTER TABLE instruction_orders
        ALTER COLUMN store_id TYPE UUID
        USING NULL::uuid
        """
    )

    # stores(id) へ FK を張り直す
    op.create_foreign_key(
        "instruction_orders_store_id_fkey",
        source_table="instruction_orders",
        referent_table="stores",
        local_cols=["store_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # ORM の __table_args__ に合わせて index を再作成
    op.create_index("ix_instruction_orders_store_due", "instruction_orders", ["store_id", "due_at"], unique=False)
    op.create_index("ix_instruction_orders_store_received", "instruction_orders", ["store_id", "received_at"], unique=False)
    op.create_index("ix_instruction_orders_store_id", "instruction_orders", ["store_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema.

    復元不能なので integer に戻す際も NULL に落とす。
    """
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_due")
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_received")
    op.execute("DROP INDEX IF EXISTS ix_instruction_orders_store_id")
    op.execute("ALTER TABLE instruction_orders DROP CONSTRAINT IF EXISTS instruction_orders_store_id_fkey")

    op.execute(
        """
        ALTER TABLE instruction_orders
        ALTER COLUMN store_id TYPE INTEGER
        USING NULL::integer
        """
    )