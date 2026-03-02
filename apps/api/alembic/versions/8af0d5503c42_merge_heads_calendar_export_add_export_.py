"""merge heads: calendar_export + add_export_fields

Revision ID: 8af0d5503c42
Revises: 5b1c0d2e3f4a, 6c2d1e3f4a5b
Create Date: 2026-03-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8af0d5503c42"

down_revision: Union[str, Sequence[str], None] = (
    "5b1c0d2e3f4a",
    "6c2d1e3f4a5b",
)

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass