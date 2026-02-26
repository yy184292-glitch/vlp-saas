"""create billing tables

Revision ID: 3b2a05e11831
Revises: 10942d13d956
Create Date: 2026-02-25
"""

from alembic import op
import sqlalchemy as sa

try:
    from sqlalchemy.dialects import postgresql
except Exception:
    postgresql = None  # type: ignore

# revision identifiers, used by Alembic.
revision = "3b2a05e11831"
down_revision = "10942d13d956"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if postgresql is not None:
        uuid_type = postgresql.UUID(as_uuid=True)
        json_type = postgresql.JSONB
    else:
        uuid_type = sa.String(36)
        json_type = sa.JSON

    op.create_table(
        "billing_documents",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("store_id", uuid_type, nullable=True),
        sa.Column("kind", sa.String(16), nullable=False),    # estimate | invoice
        sa.Column("status", sa.String(16), nullable=False),  # draft | issued | void
        sa.Column("customer_name", sa.String(255), nullable=True),

        sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),

        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_work_order_id", uuid_type, nullable=True),

        sa.Column("meta", json_type, nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_billing_documents_created_at", "billing_documents", ["created_at"])
    op.create_index("ix_billing_documents_status", "billing_documents", ["status"])
    op.create_index("ix_billing_documents_kind", "billing_documents", ["kind"])

    op.create_table(
        "billing_lines",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("billing_id", uuid_type, nullable=False),

        # snapshot
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("qty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(16), nullable=True),

        sa.Column("unit_price", sa.Integer(), nullable=True),
        sa.Column("cost_price", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=True),

        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_index("ix_billing_lines_billing_id", "billing_lines", ["billing_id"])

    op.create_foreign_key(
        "fk_billing_lines_billing_id",
        "billing_lines",
        "billing_documents",
        ["billing_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_billing_lines_billing_id", "billing_lines", type_="foreignkey")
    op.drop_index("ix_billing_lines_billing_id", table_name="billing_lines")
    op.drop_table("billing_lines")

    op.drop_index("ix_billing_documents_kind", table_name="billing_documents")
    op.drop_index("ix_billing_documents_status", table_name="billing_documents")
    op.drop_index("ix_billing_documents_created_at", table_name="billing_documents")
    op.drop_table("billing_documents")
