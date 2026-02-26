"""seed tax setting in system_settings (production-safe)

Revision ID: 20260226_01_create_system_settings_and_seed_tax
Revises: 9c1a0a2d0f11
Create Date: 2026-02-26
"""
from __future__ import annotations

from alembic import op

revision = "20260226_01_create_system_settings_and_seed_tax"
down_revision = "9c1a0a2d0f11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # system_settings のDDLは直前revision(9c1a0a2d0f11)で担保されている前提。
    # ここは「tax設定を確実に入れる」ことだけに責務を限定して衝突を避ける。
    op.execute(
        """
        INSERT INTO system_settings(key, value)
        VALUES ('tax', '{"rate": 0.10, "mode": "exclusive", "rounding": "floor"}'::jsonb)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = now();
        """
    )


def downgrade() -> None:
    # 本番で tax 設定を消す運用は基本しないので no-op
    pass