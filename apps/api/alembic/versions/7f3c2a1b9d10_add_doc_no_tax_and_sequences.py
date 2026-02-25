"""add doc_no, tax columns, and billing_sequences

Revision ID: 7f3c2a1b9d10
Revises: 3b2a05e11831
Create Date: 2026-02-26
"""

from alembic import op
import sqlalchemy as sa

try:
    from sqlalchemy.dialects import postgresql
except Exception:
    postgresql = None  # type: ignore


# revision identifiers, used by Alembic.
revision = "7f3c2a1b9d10"
down_revision = "3b2a05e11831"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------
    # billing_documents columns
    # ---------------------------------------------------------
    op.add_column(
        "billing_documents",
        sa.Column("doc_no", sa.String(32), nullable=True),
    )

    op.add_column(
        "billing_documents",
        sa.Column(
            "tax_rate",
            sa.Numeric(5, 4),
            nullable=False,
            server_default="0.10",
        ),
    )

    op.add_column(
        "billing_documents",
        sa.Column(
            "tax_mode",
            sa.String(16),
            nullable=False,
            server_default="exclusive",
        ),
    )

    op.add_column(
        "billing_documents",
        sa.Column(
            "tax_rounding",
            sa.String(16),
            nullable=False,
            server_default="floor",
        ),
    )

    op.create_index(
        "ux_billing_documents_doc_no",
        "billing_documents",
        ["doc_no"],
        unique=True,
    )

    # ---------------------------------------------------------
    # billing_sequences
    # ---------------------------------------------------------
    if postgresql is not None:
        uuid_type = postgresql.UUID(as_uuid=True)
    else:
        uuid_type = sa.String(36)

    op.create_table(
        "billing_sequences",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("store_id", uuid_type, nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("next_no", sa.Integer(), nullable=False),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_unique_constraint(
        "uq_billing_sequences_store_year_kind",
        "billing_sequences",
        ["store_id", "year", "kind"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_billing_sequences_store_year_kind",
        "billing_sequences",
        type_="unique",
    )

    op.drop_table("billing_sequences")

    op.drop_index("ux_billing_documents_doc_no", table_name="billing_documents")

    op.drop_column("billing_documents", "tax_rounding")
    op.drop_column("billing_documents", "tax_mode")
    op.drop_column("billing_documents", "tax_rate")
    op.drop_column("billing_documents", "doc_no")