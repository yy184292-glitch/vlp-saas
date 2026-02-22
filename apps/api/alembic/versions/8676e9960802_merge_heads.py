"""merge heads

Revision ID: 8676e9960802
Revises: d8eea3e78772, add_cars_user_id_permanent
Create Date: 2026-02-22 18:07:13.669660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8676e9960802'
down_revision: Union[str, Sequence[str], None] = ('d8eea3e78772', 'add_cars_user_id_permanent')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
