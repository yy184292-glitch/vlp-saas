"""Merge heads: marketcheck + existing

Revision ID: 95d40eebfa12
Revises: 1f3a9c2b7d10, 8af0d5503c42
Create Date: 2026-03-03 02:36:35.658737

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '95d40eebfa12'
down_revision: Union[str, Sequence[str], None] = ('1f3a9c2b7d10', '8af0d5503c42')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
