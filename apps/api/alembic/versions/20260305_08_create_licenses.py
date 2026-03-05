"""Create licenses table and seed superadmin user

Revision ID: 20260305_08
Revises: 20260305_07
Create Date: 2026-03-05
"""
from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import UUID

revision = "20260305_08"
down_revision = "20260305_07"
branch_labels = None
depends_on = None

SUPERADMIN_EMAIL = "admin@vlp-system.com"
SUPERADMIN_PASSWORD = "VLP@Admin2026!"


def upgrade() -> None:
    bind = op.get_bind()
    existing = set(inspect(bind).get_table_names())

    if "licenses" not in existing:
        op.create_table(
            "licenses",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "store_id",
                UUID(as_uuid=True),
                sa.ForeignKey("stores.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("plan", sa.String(32), nullable=False, server_default="starter"),
            sa.Column("status", sa.String(32), nullable=False, server_default="trial"),
            sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
            sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("NOW()"),
            ),
        )

    # ── Make users.store_id nullable BEFORE inserting superadmin (store_id=NULL) ──
    # Idempotent: DROP NOT NULL is safe even if the column is already nullable.
    op.alter_column("users", "store_id", nullable=True)

    # ── Seed superadmin user (idempotent) ──────────────────────────────────────
    existing_admin = bind.execute(
        text("SELECT id FROM users WHERE email = :email LIMIT 1"),
        {"email": SUPERADMIN_EMAIL},
    ).fetchone()

    if not existing_admin:
        try:
            from passlib.context import CryptContext

            _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            pw_bytes = SUPERADMIN_PASSWORD.encode("utf-8")[:72]
            hashed = _ctx.hash(pw_bytes)
        except Exception:
            hashed = ""

        bind.execute(
            text(
                """
                INSERT INTO users (id, email, name, password_hash, is_active, store_id, role, created_at)
                VALUES (:id, :email, :name, :pw, true, NULL, 'superadmin', NOW())
                ON CONFLICT (email) DO NOTHING
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "email": SUPERADMIN_EMAIL,
                "name": "VLP System Admin",
                "pw": hashed,
            },
        )


def downgrade() -> None:
    op.drop_table("licenses")
