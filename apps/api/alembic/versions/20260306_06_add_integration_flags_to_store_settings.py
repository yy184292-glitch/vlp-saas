"""add loan/warranty/insurance integration flags to store_settings

Revision ID: 20260306_06
Revises: 20260306_05
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa

revision = "20260306_06"
down_revision = "20260306_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("store_settings", sa.Column("loan_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("store_settings", sa.Column("warranty_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("store_settings", sa.Column("insurance_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("store_settings", sa.Column("loan_url", sa.String(512), nullable=True))
    op.add_column("store_settings", sa.Column("loan_company_name", sa.String(128), nullable=True))
    op.add_column("store_settings", sa.Column("warranty_url", sa.String(512), nullable=True))
    op.add_column("store_settings", sa.Column("warranty_company_name", sa.String(128), nullable=True))
    op.add_column("store_settings", sa.Column("insurance_url", sa.String(512), nullable=True))
    op.add_column("store_settings", sa.Column("insurance_company_name", sa.String(128), nullable=True))


def downgrade() -> None:
    for col in [
        "insurance_company_name", "insurance_url",
        "warranty_company_name", "warranty_url",
        "loan_company_name", "loan_url",
        "insurance_enabled", "warranty_enabled", "loan_enabled",
    ]:
        op.drop_column("store_settings", col)
