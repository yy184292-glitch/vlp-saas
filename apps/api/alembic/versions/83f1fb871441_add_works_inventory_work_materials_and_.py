from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "83f1fb871441"
down_revision = "877d740a147f"
branch_labels = None
depends_on = None


def upgrade():
    # =====================================================
    # works
    # =====================================================
    op.create_table(
        "works",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_works_store_id", "works", ["store_id"])
    op.create_index("ix_works_store_code", "works", ["store_id", "code"])
    op.create_index("ix_works_store_name", "works", ["store_id", "name"])
    op.create_foreign_key(
        "fk_works_store",
        "works",
        "stores",
        ["store_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # =====================================================
    # inventory_items
    # =====================================================
    op.create_table(
        "inventory_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("cost_price", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("sale_price", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("qty_on_hand", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_inventory_items_store_id", "inventory_items", ["store_id"])
    op.create_index("ix_inventory_items_store_sku", "inventory_items", ["store_id", "sku"])
    op.create_index("ix_inventory_items_store_name", "inventory_items", ["store_id", "name"])
    op.create_foreign_key(
        "fk_inventory_items_store",
        "inventory_items",
        "stores",
        ["store_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # =====================================================
    # stock_moves
    # =====================================================
    op.create_table(
        "stock_moves",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("move_type", sa.String(length=16), nullable=False),
        sa.Column("qty", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("ref_type", sa.String(length=32), nullable=True),
        sa.Column("ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_stock_moves_store_item_created", "stock_moves", ["store_id", "item_id", "created_at"])
    op.create_index("ix_stock_moves_ref", "stock_moves", ["ref_type", "ref_id"])
    op.create_foreign_key(
        "fk_stock_moves_store",
        "stock_moves",
        "stores",
        ["store_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_stock_moves_item",
        "stock_moves",
        "inventory_items",
        ["item_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # =====================================================
    # work_materials
    # =====================================================
    op.create_table(
        "work_materials",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("work_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("qty_per_work", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("work_id", "item_id", name="uq_work_materials_work_item"),
    )
    op.create_index("ix_work_materials_store_work", "work_materials", ["store_id", "work_id"])
    op.create_index("ix_work_materials_store_item", "work_materials", ["store_id", "item_id"])
    op.create_foreign_key(
        "fk_work_materials_store",
        "work_materials",
        "stores",
        ["store_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_work_materials_work",
        "work_materials",
        "works",
        ["work_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_work_materials_item",
        "work_materials",
        "inventory_items",
        ["item_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # =====================================================
    # billing_lines.work_id
    # =====================================================
    op.add_column("billing_lines", sa.Column("work_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_billing_lines_work_id", "billing_lines", ["work_id"])
    op.create_foreign_key(
        "fk_billing_lines_work",
        "billing_lines",
        "works",
        ["work_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_billing_lines_work", "billing_lines", type_="foreignkey")
    op.drop_index("ix_billing_lines_work_id", table_name="billing_lines")
    op.drop_column("billing_lines", "work_id")

    op.drop_table("work_materials")
    op.drop_table("stock_moves")
    op.drop_table("inventory_items")
    op.drop_table("works")