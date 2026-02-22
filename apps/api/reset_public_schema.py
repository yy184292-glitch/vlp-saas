from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL")
if not url:
    raise RuntimeError("DATABASE_URL が設定されていません")

engine = create_engine(url)

print("!!! WARNING !!!")
print("This will DROP SCHEMA public CASCADE and recreate it.")
print("It will delete ALL tables in public schema.")
ans = input("Type 'DROP' to continue: ").strip()

if ans != "DROP":
    print("Cancelled.")
    raise SystemExit(0)

with engine.begin() as conn:
    conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
    conn.execute(text("CREATE SCHEMA public"))
    conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
    # search_path を public 優先に（念のため）
    conn.execute(text("ALTER ROLE CURRENT_USER SET search_path TO public"))
    print("Public schema reset done.")