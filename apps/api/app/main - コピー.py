from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/v1/health")
def health():
    return {"status": "ok"}

from app.core.settings import settings
from app.db import engine
from app.models.base import Base

# router import
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.cars import router as cars_router


# DBテーブル作成（開発用）
Base.metadata.create_all(bind=engine)


# FastAPI作成
app = FastAPI(
    title="VLP SaaS API",
    version="1.0.0",
)


# CORS設定（Next.js接続用）
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# API prefix（強く推奨）
API_PREFIX = "/api/v1"


# router登録
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(cars_router, prefix=API_PREFIX)


@app.get("/")
def root():
    return {"status": "ok"}