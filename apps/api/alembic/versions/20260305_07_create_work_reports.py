"""Create work_reports, work_report_items, invoices

Revision ID: 20260305_07
Revises: 20260305_06
Create Date: 2026-03-05
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260305_07"
down_revision = "20260305_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "instruction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("instruction_orders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "car_id",
            UUID(as_uuid=True),
            sa.ForeignKey("cars.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("vehicle_category", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="in_progress"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reported_by", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
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
        "work_report_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_reports.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "work_master_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_masters.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("item_name", sa.String(255), nullable=False),
        sa.Column("item_type", sa.String(20), nullable=False, server_default="work"),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("duration_minutes", sa.Integer, nullable=True),
        sa.Column("is_checked", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("memo", sa.Text, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
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
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "report_id",
            UUID(as_uuid=True),
            sa.ForeignKey("work_reports.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("invoice_type", sa.String(20), nullable=False, server_default="estimate"),
        sa.Column("issue_date", sa.Date, nullable=False),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
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

    op.create_index("ix_work_reports_store_status", "work_reports", ["store_id", "status"])
    op.create_index(
        "ix_work_report_items_report_type", "work_report_items", ["report_id", "item_type"]
    )


def downgrade() -> None:
    op.drop_index("ix_work_report_items_report_type", table_name="work_report_items")
    op.drop_index("ix_work_reports_store_status", table_name="work_reports")
    op.drop_table("invoices")
    op.drop_table("work_report_items")
    op.drop_table("work_reports")
