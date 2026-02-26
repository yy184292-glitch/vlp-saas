"""restore missing revision (create car_valuations base table)

Revision ID: 7665741baba5
Revises: 8676e9960802
Create Date: 2026-02-25 19:33:07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine import Connection

try:
    from sqlalchemy.dialects import postgresql
except Exception:
    postgresql = None  # type: ignore

# revision identifiers, used by Alembic.
revision = "7665741baba5"
down_revision = "8676e9960802"
branch_labels = None
depends_on = None


def _has_table(conn: Connection, table_name: str) -> bool:
    insp = sa.inspect(conn)
    try:
        return table_name in insp.get_table_names()
    except Exception:
        # fail-safe: if inspection fails, assume table exists to avoid destructive ops
        return True


def upgrade() -> None:
    conn = op.get_bind()
    if _has_table(conn, "car_valuations"):
        return

    # Minimal schema to allow later migrations (e.g. 10942...) to add columns safely.
    if postgresql is not None:
        uuid_type = postgresql.UUID(as_uuid=True)
    else:
        uuid_type = sa.String(36)

    op.create_table(
        "car_valuations",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("car_id", uuid_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["car_id"], ["cars.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    conn = op.get_bind()
    if not _has_table(conn, "car_valuations"):
        return
    op.drop_table("car_valuations")