from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()
url = os.getenv("DATABASE_URL")

if not url:
    raise RuntimeError("DATABASE_URL が設定されていません")

# パスワードだけ隠して表示
p = urlparse(url)
safe_url = f"{p.scheme}://{p.username}:***@{p.hostname}:{p.port}{p.path}"
print("DATABASE_URL =", safe_url)

engine = create_engine(url)

with engine.begin() as conn:
    current_schema = conn.execute(text("select current_schema()")).scalar()
    search_path = conn.execute(text("show search_path")).scalar()
    print("current_schema =", current_schema)
    print("search_path =", search_path)

    # いま見えてるテーブル全部
    tables = conn.execute(text("""
        select table_schema, table_name
        from information_schema.tables
        where table_type='BASE TABLE'
        order by table_schema, table_name
    """)).fetchall()

    print("\nTABLES:")
    for s, t in tables:
        print(f" - {s}.{t}")

    # alembic_version
    av = conn.execute(text("""
        select table_schema, table_name
        from information_schema.tables
        where table_name='alembic_version'
    """)).fetchall()
    print("\nalembic_version table =", av)

    # cars の所在
    cars = conn.execute(text("""
        select table_schema, table_name
        from information_schema.tables
        where table_name='cars'
    """)).fetchall()
    print("cars table =", cars)