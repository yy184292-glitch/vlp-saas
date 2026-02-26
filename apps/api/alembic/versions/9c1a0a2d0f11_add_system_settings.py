"""add system_settings for default tax

Revision ID: 9c1a0a2d0f11
Revises: 7f3c2a1b9d10
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

revision = "9c1a0a2d0f11"
down_revision = "7f3c2a1b9d10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(64), primary_key=True, nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 初期値（税率10%、外税、切り捨て）
    op.execute(
        """
        INSERT INTO system_settings (key, value)
        VALUES
          ('tax', '{"rate": 0.10, "mode": "exclusive", "rounding": "floor"}')
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("system_settings")