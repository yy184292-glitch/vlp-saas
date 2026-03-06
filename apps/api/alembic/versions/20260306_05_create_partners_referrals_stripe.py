"""create partners and referrals tables, add stripe/referral fields to licenses, own_referral_code to stores

Revision ID: 20260306_05
Revises: 20260306_04
Create Date: 2026-03-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260306_05"
down_revision = "20260306_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── stores: 自店舗の紹介コード追加 ────────────────────────────────
    op.add_column(
        "stores",
        sa.Column("own_referral_code", sa.String(16), nullable=True, unique=True),
    )

    # ── partners テーブル作成 ─────────────────────────────────────────
    op.create_table(
        "partners",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        # 8文字英数字大文字（例: A3B2C4D5）
        sa.Column("code", sa.String(16), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        # silver / gold / platinum
        sa.Column("rank", sa.String(16), nullable=False, server_default="silver"),
        sa.Column("rank_updated_at", sa.DateTime(timezone=True), nullable=True),
        # own / partner / null
        sa.Column("loan_type", sa.String(16), nullable=True),
        sa.Column("insurance_type", sa.String(16), nullable=True),
        sa.Column("warranty_type", sa.String(16), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── referrals テーブル作成 ────────────────────────────────────────
    op.create_table(
        "referrals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "referrer_store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "referred_store_id",
            UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("referral_code", sa.String(32), nullable=False),
        sa.Column(
            "partner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        # pending / active / cancelled
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── licenses: Stripe フィールド + 紹介フィールド追加 ──────────────
    op.add_column("licenses", sa.Column("referral_code", sa.String(32), nullable=True))
    op.add_column("licenses", sa.Column("referral_discount", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "licenses",
        sa.Column("partner_id", UUID(as_uuid=True), sa.ForeignKey("partners.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("licenses", sa.Column("stripe_customer_id", sa.String(128), nullable=True))
    op.add_column("licenses", sa.Column("stripe_subscription_id", sa.String(128), nullable=True))
    op.add_column("licenses", sa.Column("stripe_payment_method_id", sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column("licenses", "stripe_payment_method_id")
    op.drop_column("licenses", "stripe_subscription_id")
    op.drop_column("licenses", "stripe_customer_id")
    op.drop_column("licenses", "partner_id")
    op.drop_column("licenses", "referral_discount")
    op.drop_column("licenses", "referral_code")
    op.drop_table("referrals")
    op.drop_table("partners")
    op.drop_column("stores", "own_referral_code")
