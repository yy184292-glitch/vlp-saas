"""add_export_fields_to_cars

Revision ID: 6c2d1e3f4a5b
Revises: 3c1a9c2f7b21
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6c2d1e3f4a5b"
down_revision: Union[str, Sequence[str], None] = "3c1a9c2f7b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "cars",
        sa.Column("export_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.add_column(
        "cars",
        sa.Column("export_price", sa.Numeric(12, 2), nullable=True),
    )

    op.add_column(
        "cars",
        sa.Column("export_status", sa.String(32), nullable=True),
    )

    op.add_column(
        "cars",
        sa.Column("export_image_url", sa.String(512), nullable=True),
    )

    op.add_column(
        "cars",
        sa.Column("export_description", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("cars", "export_description")
    op.drop_column("cars", "export_image_url")
    op.drop_column("cars", "export_status")
    op.drop_column("cars", "export_price")
    op.drop_column("cars", "export_enabled")

