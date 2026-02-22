from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.settings import settings

# ログ設定
config = context.config
import os
from dotenv import load_dotenv

load_dotenv()

# AlembicにDATABASE_URLを使わせる（最重要）
database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL が .env に設定されていません")

config.set_main_option("sqlalchemy.url", database_url)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ★settings から DB URL（DATABASE_URL alias 済み）
def get_url() -> str:
    url = settings.sqlalchemy_database_url
    # もし古い postgres:// が混ざってた場合の保険
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

# ★Alembic は db/session/engine を絶対 import しない
from app.models.base import Base  # noqa: E402

# ★モデルを明示 import（__init__.py は空にする）
from app.models import user  # noqa: F401, E402
from app.models import car   # noqa: F401, E402

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
