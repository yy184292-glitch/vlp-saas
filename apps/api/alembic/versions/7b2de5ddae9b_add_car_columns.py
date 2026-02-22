"""add car columns safely

Revision ID: 7b2de5ddae9b
Revises: c7c85725d6ef
Create Date: 2026-02-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "7b2de5ddae9b"
down_revision = "c7c85725d6ef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    existing = {col["name"] for col in inspector.get_columns("cars")}

    def add_column_if_missing(name: str, column: sa.Column) -> None:
        if name not in existing:
            op.add_column("cars", column)
            existing.add(name)

    # status は既存データがあるので安全に処理
    if "status" not in existing:
        op.add_column("cars", sa.Column("status", sa.String(length=20), nullable=True))
        conn.execute(sa.text("UPDATE cars SET status = '在庫' WHERE status IS NULL"))
        op.alter_column(
            "cars",
            "status",
            existing_type=sa.String(length=20),
            nullable=False,
        )

    # 以下は「存在しない場合のみ」追加
    add_column_if_missing("car_number", sa.Column("car_number", sa.String(length=50), nullable=True))
    add_column_if_missing("maker", sa.Column("maker", sa.String(length=100), nullable=True))
    add_column_if_missing("model", sa.Column("model", sa.String(length=100), nullable=True))
    add_column_if_missing("model_code", sa.Column("model_code", sa.String(length=100), nullable=True))
    add_column_if_missing("grade", sa.Column("grade", sa.String(length=100), nullable=True))

    add_column_if_missing("year", sa.Column("year", sa.Integer(), nullable=True))
    add_column_if_missing("year_month", sa.Column("year_month", sa.String(length=10), nullable=True))

    add_column_if_missing("mileage", sa.Column("mileage", sa.Integer(), nullable=True))
    add_column_if_missing("color", sa.Column("color", sa.String(length=50), nullable=True))

    add_column_if_missing("vin", sa.Column("vin", sa.String(length=100), nullable=True))
    add_column_if_missing("accident_history", sa.Column("accident_history", sa.String(length=10), nullable=True))

    add_column_if_missing("purchase_price", sa.Column("purchase_price", sa.Integer(), nullable=True))
    add_column_if_missing("expected_sell_price", sa.Column("expected_sell_price", sa.Integer(), nullable=True))
    add_column_if_missing("actual_sell_price", sa.Column("actual_sell_price", sa.Integer(), nullable=True))

    add_column_if_missing("purchase_date", sa.Column("purchase_date", sa.Date(), nullable=True))
    add_column_if_missing("sell_date", sa.Column("sell_date", sa.Date(), nullable=True))

    add_column_if_missing("location", sa.Column("location", sa.String(length=100), nullable=True))
    add_column_if_missing("memo", sa.Column("memo", sa.Text(), nullable=True))

    add_column_if_missing("inspection_expiry", sa.Column("inspection_expiry", sa.Date(), nullable=True))
    add_column_if_missing("insurance_expiry", sa.Column("insurance_expiry", sa.Date(), nullable=True))


def downgrade() -> None:
    # downgrade は必要なら後で安全に設計
    pass