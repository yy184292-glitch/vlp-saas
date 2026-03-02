"""add export fields to cars

Revision ID: 20260302_02_add_export_fields_to_cars
Revises: 10942d13d956, 3c1a9c2f7b21
Create Date: 2026-03-02

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260302_02_add_export_fields_to_cars"
down_revision: Union[str, Sequence[str], None] = ("10942d13d956", "3c1a9c2f7b21")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 公開フラグ
    op.add_column(
        "cars",
        sa.Column("export_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 海外向け価格（表示用）
    op.add_column("cars", sa.Column("export_price", sa.Integer(), nullable=True))

    # 公開ページ用の任意項目
    op.add_column("cars", sa.Column("export_image_url", sa.String(), nullable=True))
    op.add_column("cars", sa.Column("export_description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cars", "export_description")
    op.drop_column("cars", "export_image_url")
    op.drop_column("cars", "export_price")
    op.drop_column("cars", "export_enabled")
