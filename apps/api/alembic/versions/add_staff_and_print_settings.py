"""add staff master and print settings

Revision ID: add_staff_and_print_settings
Revises: add_cars_user_id_permanent
Create Date: 2026-03-04

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "add_staff_and_print_settings"
down_revision = "add_cars_user_id_permanent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # store_staff master
    op.create_table(
        "store_staff",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("name_kana", sa.String(length=255), nullable=True),
        sa.Column("postal_code", sa.String(length=16), nullable=True),
        sa.Column("address1", sa.String(length=255), nullable=True),
        sa.Column("address2", sa.String(length=255), nullable=True),
        sa.Column("tel", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_store_staff_store_id ON store_staff (store_id)")

    # car status master (per store)
    op.create_table(
        "car_status_master",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#E5E7EB"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_store_staff_store_id ON store_staff (store_id)")

    # store settings additions
    op.add_column("store_settings", sa.Column("default_staff_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("store_settings", sa.Column("print_fields", postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # cars: owner and transferee fields for documents
    op.add_column("cars", sa.Column("owner_name", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("owner_name_kana", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("owner_postal_code", sa.String(length=16), nullable=True))
    op.add_column("cars", sa.Column("owner_address1", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("owner_address2", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("owner_tel", sa.String(length=32), nullable=True))

    op.add_column("cars", sa.Column("new_owner_name", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("new_owner_name_kana", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("new_owner_postal_code", sa.String(length=16), nullable=True))
    op.add_column("cars", sa.Column("new_owner_address1", sa.String(length=255), nullable=True))
    op.add_column("cars", sa.Column("new_owner_address2", sa.String(length=255), nullable=True))


def downgrade() -> None:
    # cars
    for col in [
        "new_owner_address2","new_owner_address1","new_owner_postal_code","new_owner_name_kana","new_owner_name",
        "owner_tel","owner_address2","owner_address1","owner_postal_code","owner_name_kana","owner_name",
    ]:
        op.execute("DROP INDEX IF EXISTS ix_store_staff_store_id")

    # store settings
    op.drop_column("store_settings", "print_fields")
    op.drop_column("store_settings", "default_staff_id")

    op.drop_index("ix_car_status_master_store_id", table_name="car_status_master")
    op.drop_table("car_status_master")

    op.drop_index("ix_store_staff_store_id", table_name="store_staff")
    op.drop_table("store_staff")
