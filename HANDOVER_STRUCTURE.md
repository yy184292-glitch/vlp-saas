# VLP SaaS 引き継ぎ：ファイル配置と import ルール（ズレ防止）

このプロジェクトは monorepo 構成：

- apps/api → FastAPI backend
- apps/web → Next.js frontend

引き継ぎ時にズレやすいのは Next.js 側です。

---

# 1. 絶対に守るべき配置ルール

## ページ（ルーティング）

正しい場所：

apps/web/app/**/page.tsx

例：

apps/web/app/login/page.tsx → /login  
apps/web/app/cars/page.tsx → /cars  

❌ NG：

apps/web/src/app/login/page.tsx  
→ Next.js が拾わず 404 になる

---

## 実装コード（API client / features）

正しい場所：

apps/web/src/lib/api.ts  
apps/web/src/features/**

---

## 共通UI部品

正しい場所：

apps/web/app/_components/**

---

# 2. import の正解（最重要）

すべてこれで統一：

```ts
import { login } from "@/lib/api";





apps/
  api/
    app/
      main.py

  web/
    app/
      layout.tsx
      login/page.tsx
      cars/page.tsx
      shaken/page.tsx
      users/page.tsx
      _components/

    src/
      lib/api.ts
      features/

    tsconfig.json



Render 設定（vlp-web）
    Root Directory:　apps/web
    Build Command:　npm ci && npm run build
    Start Command:　npm run start



5. 新しくページを追加する場合
apps/web/app/shaken/page.tsx

6. 新しくAPI client追加する場合
apps/web/src/lib/shakenApi.ts


7. 引き継ぎチェックリスト
ページは apps/web/app にあるか

API client は apps/web/src/lib にあるか

tsconfig の paths が @/* → src/* になっているか

Render の Root Directory が apps/web か
