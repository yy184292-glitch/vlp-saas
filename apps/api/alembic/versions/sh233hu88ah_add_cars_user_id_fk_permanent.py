from alembic import op
import sqlalchemy as sa
import uuid


# revision identifiers
revision = "add_cars_user_id_permanent"
down_revision = "aa5d55cd64f8"
branch_labels = None
depends_on = None


SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000000")
SYSTEM_EMAIL = "system@local"


def upgrade():
    conn = op.get_bind()

    # 1) system user 作成（存在しなければ）
    conn.execute(sa.text("""
        INSERT INTO users (id, email, password_hash, is_active, created_at)
        VALUES (:id, :email, NULL, true, NOW())
        ON CONFLICT DO NOTHING
    """), {"id": SYSTEM_USER_ID, "email": SYSTEM_EMAIL})

    # 2) cars.user_id 列追加（冪等）
    conn.execute(sa.text("""
        ALTER TABLE cars
        ADD COLUMN IF NOT EXISTS user_id UUID
    """))

    # 3) backfill（冪等）
    conn.execute(sa.text("""
        UPDATE cars
        SET user_id = :id
        WHERE user_id IS NULL
    """), {"id": SYSTEM_USER_ID})

    # 4) NOT NULL（冪等）
    conn.execute(sa.text("""
        ALTER TABLE cars
        ALTER COLUMN user_id SET NOT NULL
    """))

    # 5) FK（冪等）
    conn.execute(sa.text("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_cars_user_id'
        ) THEN
            ALTER TABLE cars
            ADD CONSTRAINT fk_cars_user_id
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE;
        END IF;
    END$$;
    """))

    # 6) index（冪等）
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_cars_user_id
        ON cars(user_id)
    """))


def downgrade():
    conn = op.get_bind()

    conn.execute(sa.text("""
        DROP INDEX IF EXISTS ix_cars_user_id
    """))

    conn.execute(sa.text("""
        ALTER TABLE cars
        DROP CONSTRAINT IF EXISTS fk_cars_user_id
    """))

    conn.execute(sa.text("""
        ALTER TABLE cars
        DROP COLUMN IF EXISTS user_id
    """))

    conn.execute(sa.text("""
        DELETE FROM users
        WHERE id = :id
    """), {"id": SYSTEM_USER_ID})
