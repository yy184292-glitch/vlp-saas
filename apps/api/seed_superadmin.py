#!/usr/bin/env python3
"""
Idempotent superadmin seed script.

Creates or repairs the admin@vlp-system.com account with role='superadmin'.
- If the user does not exist     → INSERT with correct bcrypt hash
- If the user exists with bad hash (empty / non-bcrypt) → UPDATE hash + ensure role
- If the user exists and is fine  → no-op

Safe to run on every startup.
"""
from __future__ import annotations

import os
import sys
import uuid

SUPERADMIN_EMAIL = "admin@vlp-system.com"
SUPERADMIN_PASSWORD = "VLP@Admin2026!"


def main() -> None:
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not db_url:
        print("[seed_superadmin] DATABASE_URL not set – skipping.", flush=True)
        return

    try:
        from sqlalchemy import create_engine, text
    except ImportError as e:
        print(f"[seed_superadmin] sqlalchemy not available: {e} – skipping.", flush=True)
        return

    try:
        from app.core.security import get_password_hash
        hashed = get_password_hash(SUPERADMIN_PASSWORD)
    except Exception as e:
        print(f"[seed_superadmin] Failed to hash password: {e} – aborting.", flush=True)
        sys.exit(1)

    try:
        engine = create_engine(db_url, pool_pre_ping=True)

        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT id, password_hash, role FROM users WHERE email = :email"),
                {"email": SUPERADMIN_EMAIL},
            ).fetchone()

            if row is None:
                conn.execute(
                    text(
                        """
                        INSERT INTO users
                            (id, email, name, password_hash, is_active, store_id, role, created_at)
                        VALUES
                            (:id, :email, 'VLP System Admin', :pw, true, NULL, 'superadmin', NOW())
                        ON CONFLICT (email) DO NOTHING
                        """
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "email": SUPERADMIN_EMAIL,
                        "pw": hashed,
                    },
                )
                print(
                    f"[seed_superadmin] Created superadmin user: {SUPERADMIN_EMAIL}",
                    flush=True,
                )
            else:
                existing_hash: str = row[1] or ""
                existing_role: str = row[2] or ""
                needs_update = (
                    not existing_hash
                    or not existing_hash.startswith("$2")
                    or existing_role != "superadmin"
                )
                if needs_update:
                    conn.execute(
                        text(
                            """
                            UPDATE users
                            SET password_hash = :pw,
                                role = 'superadmin',
                                is_active = true
                            WHERE email = :email
                            """
                        ),
                        {"pw": hashed, "email": SUPERADMIN_EMAIL},
                    )
                    print(
                        f"[seed_superadmin] Fixed superadmin account: {SUPERADMIN_EMAIL}",
                        flush=True,
                    )
                else:
                    print(
                        f"[seed_superadmin] Superadmin OK: {SUPERADMIN_EMAIL}",
                        flush=True,
                    )
    except Exception as e:
        print(f"[seed_superadmin] DB error: {e}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
