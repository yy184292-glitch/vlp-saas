#!/usr/bin/env bash
set -e

echo "[start.sh] Running database migrations..."
alembic upgrade head

echo "[start.sh] Seeding superadmin user..."
python seed_superadmin.py || echo "[start.sh] WARNING: seed_superadmin.py failed – server will start anyway"

echo "[start.sh] Starting API server..."
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
