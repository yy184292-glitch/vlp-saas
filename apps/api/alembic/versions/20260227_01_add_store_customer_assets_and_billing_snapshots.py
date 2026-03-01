"""Add stores/customers/assets master tables and billing snapshots

Revision ID: 20260227_01_master
Revises: 20260226_03_seq_uq
Create Date: 2026-02-27
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260227_01_master"
down_revision = "20260226_03_seq_uq"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(name)


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table(table):
        return False
    cols = {c["name"] for c in insp.get_columns(table)}
    return column in cols


def _index_exists(index_name: str) -> bool:
    # Postgresのインデックス存在チェック（public schema想定）
    bind = op.get_bind()
    sql = sa.text(
        """
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = :name
        LIMIT 1
        """
    )
    return bind.execute(sql, {"name": index_name}).scalar() is not None


def upgrade() -> None:
    # ------------------------------------------------------------
    # stores
    # ------------------------------------------------------------
    if not _table_exists("stores"):
        op.create_table(
            "stores",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),

            sa.Column("postal_code", sa.String(length=16), nullable=True),
            sa.Column("address1", sa.String(length=255), nullable=True),
            sa.Column("address2", sa.String(length=255), nullable=True),
            sa.Column("tel", sa.String(length=32), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),

            sa.Column("invoice_number", sa.String(length=32), nullable=True),

            sa.Column("bank_name", sa.String(length=64), nullable=True),
            sa.Column("bank_branch", sa.String(length=64), nullable=True),
            sa.Column("bank_account_type", sa.String(length=16), nullable=True),
            sa.Column("bank_account_number", sa.String(length=32), nullable=True),
            sa.Column("bank_account_holder", sa.String(length=128), nullable=True),

            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("timezone('utc', now())"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("timezone('utc', now())"),
            ),
        )

    if not _index_exists("ix_stores_name"):
        # create_index は table が存在しないと落ちるので stores がある前提
        if _table_exists("stores"):
            op.create_index("ix_stores_name", "stores", ["name"])

    # ------------------------------------------------------------
    # customers
    # ------------------------------------------------------------
    if not _table_exists("customers"):
        op.create_table(
            "customers",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),

            sa.Column(
                "store_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("stores.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),

            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("honorific", sa.String(length=16), nullable=False, server_default=sa.text("'御中'")),

            sa.Column("postal_code", sa.String(length=16), nullable=True),
            sa.Column("address1", sa.String(length=255), nullable=True),
            sa.Column("address2", sa.String(length=255), nullable=True),
            sa.Column("tel", sa.String(length=32), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("contact_person", sa.String(length=255), nullable=True),

            sa.Column("payment_terms", sa.String(length=255), nullable=True),

            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("timezone('utc', now())"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("timezone('utc', now())"),
            ),
        )

    if not _index_exists("ix_customers_store_name"):
        if _table_exists("customers"):
            op.create_index("ix_customers_store_name", "customers", ["store_id", "name"])

    # ------------------------------------------------------------
    # assets
    # ------------------------------------------------------------
    if not _table_exists("assets"):
        op.create_table(
            "assets",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),

            sa.Column(
                "store_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("stores.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),

            sa.Column("kind", sa.String(length=16), nullable=False),  # logo / stamp
            sa.Column("content_type", sa.String(length=128), nullable=True),
            sa.Column("file_path", sa.String(length=1024), nullable=False),

            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("timezone('utc', now())"),
            ),
        )

    if not _index_exists("ix_assets_store_kind"):
        if _table_exists("assets"):
            op.create_index("ix_assets_store_kind", "assets", ["store_id", "kind"])

    # ------------------------------------------------------------
    # billing_documents: customer_id + snapshots
    # ------------------------------------------------------------
    if _table_exists("billing_documents"):
        if not _column_exists("billing_documents", "customer_id"):
            op.add_column(
                "billing_documents",
                sa.Column(
                    "customer_id",
                    postgresql.UUID(as_uuid=True),
                    sa.ForeignKey("customers.id", ondelete="SET NULL"),
                    nullable=True,
                ),
            )

        if not _column_exists("billing_documents", "issued_store_snapshot"):
            op.add_column("billing_documents", sa.Column("issued_store_snapshot", sa.JSON(), nullable=True))

        if not _column_exists("billing_documents", "issued_customer_snapshot"):
            op.add_column("billing_documents", sa.Column("issued_customer_snapshot", sa.JSON(), nullable=True))

        if not _index_exists("ix_billing_documents_customer_id"):
            op.create_index("ix_billing_documents_customer_id", "billing_documents", ["customer_id"])

        if not _index_exists("ix_billing_documents_store_customer"):
            op.create_index("ix_billing_documents_store_customer", "billing_documents", ["store_id", "customer_id"])


def downgrade() -> None:
    # downgrade は「存在するものだけ落とす」方針にしておく（環境差で落ちないように）
    bind = op.get_bind()
    insp = sa.inspect(bind)

    def has_table(t: str) -> bool:
        return insp.has_table(t)

    def has_col(t: str, c: str) -> bool:
        if not has_table(t):
            return False
        return c in {x["name"] for x in insp.get_columns(t)}

    # billing_documents rollback
    if has_table("billing_documents"):
        # index
        if _index_exists("ix_billing_documents_store_customer"):
            op.drop_index("ix_billing_documents_store_customer", table_name="billing_documents")
        if _index_exists("ix_billing_documents_customer_id"):
            op.drop_index("ix_billing_documents_customer_id", table_name="billing_documents")

        # columns
        if has_col("billing_documents", "issued_customer_snapshot"):
            op.drop_column("billing_documents", "issued_customer_snapshot")
        if has_col("billing_documents", "issued_store_snapshot"):
            op.drop_column("billing_documents", "issued_store_snapshot")
        if has_col("billing_documents", "customer_id"):
            op.drop_column("billing_documents", "customer_id")

    # masters rollback（既存環境で使っている可能性があるので、落とすのは慎重に）
    # ※開発DBなら消してOKだが、本番想定では migration で DROP は避けることが多い
    if _index_exists("ix_assets_store_kind") and has_table("assets"):
        op.drop_index("ix_assets_store_kind", table_name="assets")
    if has_table("assets"):
        op.drop_table("assets")

    if _index_exists("ix_customers_store_name") and has_table("customers"):
        op.drop_index("ix_customers_store_name", table_name="customers")
    if has_table("customers"):
        op.drop_table("customers")

    if _index_exists("ix_stores_name") and has_table("stores"):
        op.drop_index("ix_stores_name", table_name="stores")
    if has_table("stores"):
        op.drop_table("stores")