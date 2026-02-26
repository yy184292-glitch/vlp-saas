"""create system_settings and seed tax

Revision ID: 20260226_01
Revises: 7f3c2a1b9d10
Create Date: 2026-02-26
"""
from alembic import op
import sqlalchemy as sa

try:
    from sqlalchemy.dialects import postgresql
except Exception:
    postgresql = None  # type: ignore

revision = "20260226_01"
down_revision = "7f3c2a1b9d10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if postgresql is None:
        # Postgres 前提の jsonb なので、非Postgresは json に落とす
        value_type = sa.JSON()
    else:
        value_type = postgresql.JSONB(astext_type=sa.Text())

    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(64), primary_key=True, nullable=False),
        sa.Column("value", value_type, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # seed tax
    if postgresql is not None:
        op.execute(
            """
            INSERT INTO system_settings(key, value)
            VALUES ('tax', '{"rate": 0.10, "mode": "exclusive", "rounding": "floor"}'::jsonb)
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = now();
            """
        )
    else:
        op.execute(
            """
            INSERT INTO system_settings(key, value)
            VALUES ('tax', '{"rate": 0.10, "mode": "exclusive", "rounding": "floor"}')
            """
        )


def downgrade() -> None:
    op.drop_table("system_settings")