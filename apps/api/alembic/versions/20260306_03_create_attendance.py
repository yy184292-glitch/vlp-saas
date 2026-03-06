"""create attendance table

Revision ID: 20260306_03
Revises: 20260306_02
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260306_03"
down_revision = "20260306_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "attendance",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("store_id", UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),

        # 勤務日（JST日付）
        sa.Column("work_date", sa.Date, nullable=False),

        # 出勤打刻
        sa.Column("clock_in", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clock_in_lat", sa.Float, nullable=True),
        sa.Column("clock_in_lng", sa.Float, nullable=True),
        sa.Column("clock_in_address", sa.Text, nullable=True),

        # 退勤打刻
        sa.Column("clock_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clock_out_lat", sa.Float, nullable=True),
        sa.Column("clock_out_lng", sa.Float, nullable=True),
        sa.Column("clock_out_address", sa.Text, nullable=True),

        sa.Column("note", sa.Text, nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),

        # 1ユーザー1日1レコード
        sa.UniqueConstraint("store_id", "user_id", "work_date", name="uq_attendance_user_date"),
    )

    op.create_index("ix_attendance_store_date", "attendance", ["store_id", "work_date"])


def downgrade() -> None:
    op.drop_table("attendance")
