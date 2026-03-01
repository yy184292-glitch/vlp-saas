"""Add store plan/seat_limit and store_invites

Revision ID: 20260302_01_invites
Revises: 20260227_01_master
Create Date: 2026-03-02

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260302_01_invites"
down_revision = "20260227_01_master"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # stores: plan_code, seat_limit
    with op.batch_alter_table("stores") as batch:
        batch.add_column(sa.Column("plan_code", sa.String(length=32), nullable=False, server_default="basic"))
        batch.add_column(sa.Column("seat_limit", sa.Integer(), nullable=False, server_default="5"))

    # store_invites
    op.create_table(
        "store_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="staff"),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_index("ix_store_invites_store_id", "store_invites", ["store_id"])
    op.create_index("ix_store_invites_code", "store_invites", ["code"], unique=True)
    op.create_index("ix_store_invites_created_at", "store_invites", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_store_invites_created_at", table_name="store_invites")
    op.drop_index("ix_store_invites_code", table_name="store_invites")
    op.drop_index("ix_store_invites_store_id", table_name="store_invites")
    op.drop_table("store_invites")

    with op.batch_alter_table("stores") as batch:
        batch.drop_column("seat_limit")
        batch.drop_column("plan_code")
