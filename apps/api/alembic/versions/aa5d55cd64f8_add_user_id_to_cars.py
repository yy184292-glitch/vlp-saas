from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "aa5d55cd64f8"
down_revision = "7b2de5ddae9b"
branch_labels = None
depends_on = None


def upgrade():
    # user_id カラムは既に存在するため追加しない

    # index（存在しなければ作成）
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cars_user_id ON cars (user_id)"
    )

    # FK（存在しなければ作成）
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_cars_user_id'
            ) THEN
                ALTER TABLE cars
                ADD CONSTRAINT fk_cars_user_id
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE;
            END IF;
        END $$;
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_cars_user_id")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_cars_user_id'
            ) THEN
                ALTER TABLE cars
                DROP CONSTRAINT fk_cars_user_id;
            END IF;
        END $$;
        """
    )