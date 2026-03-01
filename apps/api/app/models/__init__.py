"""
Models package.

目的:
- Alembic / アプリ起動時に全モデルモジュールを import し、
  Base.metadata に確実にテーブル定義を登録する。

方針:
- クラス名に依存しない（UserORM などの名前に依存すると壊れる）
- 代わりに「モジュール import」に寄せる
"""

from __future__ import annotations

# NOTE:
# import すること自体が目的（副作用で Base.metadata に登録される）なので noqa を付ける。

from app.models import user  # noqa: F401
from app.models import car  # noqa: F401
from app.models import car_valuation  # noqa: F401

from app.models import system_setting  # noqa: F401
from app.models import billing_sequence  # noqa: F401
from app.models import billing  # noqa: F401

from app.models import store  # noqa: F401
from app.models import customer  # noqa: F401
from app.models import asset  # noqa: F401