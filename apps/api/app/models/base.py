# app/models/base.py

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    すべてのSQLAlchemyモデルの共通Baseクラス
    Alembicがテーブルを検出するためにも必要
    """
    pass