"""merge expenses and invites heads

Revision ID: 69b3f489ef79
Revises: 20260301_01_expenses, 20260302_01_invites
Create Date: 2026-03-02 01:35:27.657158

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '69b3f489ef79'
down_revision: Union[str, Sequence[str], None] = ('20260301_01_expenses', '20260302_01_invites')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
