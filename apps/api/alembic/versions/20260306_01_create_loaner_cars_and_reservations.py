"""create loaner_cars and loaner_reservations tables

Revision ID: 20260306_01
Revises: 20260305_09
Create Date: 2026-03-06
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260306_01"
down_revision = "20260305_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loaner_cars",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plate_no", sa.String(32), nullable=True),
        sa.Column("color", sa.String(64), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "loaner_reservations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "loaner_car_id",
            UUID(as_uuid=True),
            sa.ForeignKey("loaner_cars.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("customer_name", sa.String(255), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_loaner_reservations_car_dates",
        "loaner_reservations",
        ["loaner_car_id", "start_date", "end_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_loaner_reservations_car_dates", table_name="loaner_reservations")
    op.drop_table("loaner_reservations")
    op.drop_table("loaner_cars")
