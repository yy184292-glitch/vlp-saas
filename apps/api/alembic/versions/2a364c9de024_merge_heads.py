"""merge heads

Revision ID: 2a364c9de024
Revises: add_staff_and_print_settings, c8b1f2d4a9e3
Create Date: 2026-03-04 19:18:12.834748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a364c9de024'
down_revision: Union[str, Sequence[str], None] = ('add_staff_and_print_settings', 'c8b1f2d4a9e3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
