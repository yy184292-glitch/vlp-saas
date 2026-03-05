# VLP SaaS 作業進捗ログ

## ルール
- **1ファイル = 1コミット**（複数ファイルが必要な場合は関連最小単位でまとめる）
- このファイルを随時更新して再開ポイントとする

---

## 完了済み作業

### Phase 1: クリティカルバグ修正
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 1 | `apps/api/app/models/car.py` | Car クラスのインデント修正、重複フィールド削除 | cb16808 |
| 2 | `apps/web/app/_components/UiPreferences.tsx` | 未追跡ファイルをコミット | cb16808 |
| 3 | `apps/web/app/cars/new/ocr/` | OCR車両登録ページをコミット | cb16808 |

### Phase 2A: Cookie 認証移行（Next.js プロキシ方式）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 4 | `apps/web/next.config.ts` | `/api/v1/*` → FastAPI リライト追加 | 935e979 |
| 5 | `apps/web/middleware.ts` | Cookie → Authorization ヘッダー変換 + CSRF チェック | 935e979 |
| 6 | `apps/web/app/api/auth/login/route.ts` | httpOnly Cookie セット | 935e979 |
| 7 | `apps/web/app/api/auth/logout/route.ts` | Cookie 削除 | 935e979 |
| 8 | `apps/web/app/api/auth/me/route.ts` | Cookie 検証 → FastAPI `/users/me` | 935e979 |
| 9 | `apps/web/src/lib/api.ts` | localStorage 廃止、Cookie 方式に移行 | 935e979 |
| 10 | `apps/web/app/_components/AuthGate.tsx` | `/api/auth/me` で認証確認 | 935e979 |
| 11 | `apps/web/app/login/page.tsx` | Cookie 方式に対応 | 935e979 |
| 12 | `apps/web/app/register/page.tsx` | Cookie 方式に対応 | 935e979 |

### Phase 2B: セキュリティ強化
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 13 | `apps/api/requirements.txt` | slowapi, sentry-sdk 追加 | 935e979 |
| 14 | `apps/api/app/core/limiter.py` | SlowAPI limiter シングルトン | 935e979 |
| 15 | `apps/api/app/main.py` | Sentry 初期化、SlowAPI ミドルウェア登録 | 935e979 |
| 16 | `apps/api/app/routes/auth.py` | レートリミット追加（login: 10/min, register: 5/min） | 935e979 |
| 17 | `apps/api/app/routes/ocr.py` | MIME/拡張子検証、エラーメッセージ隠蔽 | 935e979 |
| 18 | `apps/web/sentry.client.config.ts` | フロント Sentry 設定（後に無効化） | 935e979 |
| 19 | `apps/web/sentry.server.config.ts` | サーバー Sentry 設定（後に無効化） | 935e979 |

### Phase 3: 機能完成
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 20 | `apps/web/app/cars/new/page.tsx` | 車両登録フォーム全フィールド + OCR Dialog モーダル | 935e979 |
| 21 | `apps/web/app/cars/new/ocr/OcrContent.tsx` | OCR コンポーネント分離 | 935e979 |
| 22 | `apps/web/app/cars/new/ocr/page.tsx` | OcrContent を利用するよう修正 | 935e979 |

### Phase 4: UI/UX
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 23 | `apps/web/app/_components/ClientNav.tsx` | ログアウトボタン日本語化、モバイルスクロール対応 | 935e979 |
| 24 | `apps/web/app/globals.css` | モバイル横スクロール防止 | 935e979 |
| 25 | `apps/web/src/lib/api/core.ts` | api.ts ドメイン分割: コア | 935e979 |
| 26 | `apps/web/src/lib/api/auth.ts` | api.ts ドメイン分割: 認証 | 935e979 |
| 27 | `apps/web/src/lib/api/cars.ts` | api.ts ドメイン分割: 車両 | 935e979 |
| 28 | `apps/web/src/lib/api/reports.ts` | api.ts ドメイン分割: レポート | 935e979 |
| 29 | `apps/web/src/lib/api/inventory.ts` | api.ts ドメイン分割: 在庫 | 935e979 |
| 30 | `apps/web/src/lib/api/index.ts` | api.ts ドメイン分割: バレル | 935e979 |

### バグ修正（デプロイ後）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 31 | `apps/web/package.json` | @sentry/nextjs 削除（Next.js 16 peer dep 競合） | bd7856a |
| 32 | `apps/web/sentry.client.config.ts` | Sentry 無効化コメント | bd7856a |
| 33 | `apps/web/sentry.server.config.ts` | Sentry 無効化コメント | bd7856a |
| 34 | `apps/web/src/components/cars/car-table.tsx` | 新 Car 型・listCars 型エラー修正 | b116e3b |
| 35 | `apps/web/src/components/cars/car-dialog.tsx` | 新 Car 型に対応 | b116e3b |
| 36 | `apps/web/middleware.ts` | `request.nextUrl.pathname` に修正 + CSRF 本番対応 | 92bad4e |
| 37 | `apps/web/app/api/auth/login/route.ts` | API_BASE_URL 未設定時の 503、エラーメッセージ改善 | 92bad4e |
| 38 | `apps/web/app/api/auth/me/route.ts` | ネットワークエラー時 503 返却（401 と区別） | 92bad4e |
| 39 | `apps/web/app/_components/AuthGate.tsx` | 503 時は「接続中...」表示（ログインへリダイレクトしない） | 92bad4e |
| 40 | `apps/api/app/routes/auth.py` | `Annotated[..., Body()]` で slowapi + FastAPI の body 誤認識を修正 | edbee9a |
| 41 | `apps/api/alembic/versions/20260305_01_...` | `users` テーブルに `store_id`, `role` カラム追加マイグレーション | e5ebb67 |
| 42 | `apps/api/app/models/user.py` | `store_id` を `Optional[uuid.UUID]` / nullable=True に修正（システムユーザー対応） | e5ebb67 |
| 43 | `apps/api/start.sh` | `alembic upgrade head` 追加、`app.main:app` に修正、`$PORT` 修正 | b54585e |
| 44 | `apps/api/app/models/store.py` | `prefecture` カラム追加 | f3b20f0 |
| 45 | `apps/api/app/schemas/store.py` + `routes/stores.py` | `prefecture` フィールドをスキーマ・ルートに追加 | 1eed354 |
| 46 | `apps/api/alembic/versions/20260305_02_...` | `stores.prefecture` カラム追加マイグレーション | 5c488bc |
| 47 | `apps/api/app/models/user.py` + `routes/auth.py` + `routes/users.py` + `auth.ts` | `users.name` フィールド追加、登録ルート修正、`/me` に name 追加 | 6378a70 |
| 48 | `apps/api/alembic/versions/20260305_03_...` | `users.name` カラム追加マイグレーション | 9ca3514 |
| 49 | `apps/api/app/routes/auth.py` | slowapi + FastAPI body injection 競合を `request.json()` 方式で完全回避 | 5f2141c |
| 50 | `render.yaml` | Render IaC 設定追加 | 978022c |
| 51 | `apps/web/app/api/auth/me/route.ts` | FastAPI 5xx → 503 変換（401 に変換していたためリダイレクトループ発生） | 40d2471 |
| 52 | `apps/web/app/_components/AuthGate.tsx` | 503/ネットワークエラー時に自動リトライ追加、即時リダイレクト抑制 | 54d1584 |

### Phase 5: 整備プリセット機能
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 53 | `apps/api/alembic/versions/20260305_04_...` | `maintenance_presets` テーブル作成・デフォルトデータ seed | 4a671d4 |
| 54 | `apps/api/app/models/maintenance_preset.py` | MaintenancePresetORM モデル | c6d5cee |
| 55 | `apps/api/app/schemas/maintenance_preset.py` | Pydantic スキーマ (Create/Update/Out) | b7ba159 |
| 56 | `apps/api/app/routes/maintenance_presets.py` | CRUD API エンドポイント (list/categories/create/update/delete) | db9db54 |
| 57 | `apps/api/app/main.py` | maintenance_presets ルーター登録 | 7e4a8ba |
| 58 | `apps/web/src/lib/api/maintenancePresets.ts` + `index.ts` | フロント API クライアント | 073546e |
| 59 | `apps/web/app/(app)/masters/presets/page.tsx` | 整備プリセット管理ページ | 54adeae |
| 60 | `apps/web/app/(app)/masters/page.tsx` | マスタハブに整備プリセットリンク追加 | 55dc2c3 |

### Phase 6: 作業マスタ統合（maintenance_presets → work_masters）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 61 | `apps/api/alembic/versions/20260305_06_create_work_masters.py` | `work_masters` + `work_master_rates` テーブル作成・62件seed・maintenance_presetsドロップ | c00b47b |
| 62 | `apps/api/app/models/work_master.py` | WorkMasterORM・WorkMasterRateORM モデル（relationship/cascade） | 3ef466d |
| 63 | `apps/api/app/schemas/work_master.py` | Pydantic スキーマ (Out/ForVehicle/Create/Update) + WORK_CATEGORIES/VEHICLE_CATEGORIES | b220581 |
| 64 | `apps/api/app/routes/work_masters.py` | CRUD API（list/by-vehicle-category/get/create/update/delete） ルート順序注意 | fafa8ef |
| 65 | `apps/api/app/main.py` | maintenance_presetsルーター → work_mastersルーターに差し替え | 7f319cd |
| 66 | `apps/web/src/lib/api/workMasters.ts` + `index.ts` | フロント API クライアント・型定義・定数 | 4ab0a28 |
| 67 | `apps/web/app/(app)/masters/work/page.tsx` | 作業マスタ管理ページ（カテゴリグルーピング・展開行・車種別工賃ダイアログ） | efb0805 |
| 68 | `apps/web/app/(app)/masters/presets/page.tsx` | /masters/work へリダイレクト（旧整備プリセットページ） | 19d7607 |
| 69 | `apps/web/app/(app)/masters/page.tsx` | マスタハブから整備プリセットカード削除・作業マスタ説明更新 | 283c5c2 |

### Phase 7: 作業報告書・見積/請求書・PDF出力
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 70 | `apps/api/alembic/versions/20260305_07_create_work_reports.py` | `work_reports`・`work_report_items`・`invoices` テーブル作成 | f367914 |
| 71 | `apps/api/app/models/work_report.py` | WorkReportORM・WorkReportItemORM・InvoiceORM モデル | 8948e3f |
| 72 | `apps/api/app/schemas/work_report.py` | Pydantic スキーマ (Create/Update/Out) | 5ccf6f5 |
| 73 | `apps/api/app/routes/work_reports.py` | CRUD API (list/get/create/patch/complete/delete + items + invoices) | c2e3e7d |
| 74 | `apps/api/app/main.py` | work_reports ルーター登録 | a11cfc7 |
| 75 | `apps/web/src/lib/api/workReports.ts` + `index.ts` | フロント API クライアント・型定義 | fca7d8a |
| 76 | `apps/web/src/components/ui/numpad.tsx` | テンキー UI コンポーネント（スライドアップ・useNumpad hook） | 852dc78 |
| 77 | `apps/web/app/(app)/work-orders/[id]/report/page.tsx` | 作業報告書ページ（チェックリスト・追加部材・合計・完了報告） | 7bf7521 |
| 78 | `apps/web/app/(app)/work-orders/[id]/invoice/page.tsx` | 見積/請求書確認・window.print() PDF出力 | 5e495b6 |
| 79 | `apps/web/app/(app)/work-orders/page.tsx` | 作業指示書に「作業報告書を作成」ボタン追加 | 680a522 |

### Phase 8: 見積書・請求書 UI品質改善
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 80 | `apps/web/app/(app)/work-orders/[id]/invoice/page.tsx` | 日本語化・日付YYYY年M月D日・発行番号自動採番・ステータス色分け・書類レイアウト・縞模様テーブル・合計右下大表示・A4印刷CSS | 0d92ef3 |
| 81 | `apps/web/app/globals.css` | A4印刷CSS（@page A4・ナビ非表示・print-color-adjust） | 602e9c0 |

---

## 未対応 / 今後の課題

| 優先度 | 内容 | 対象ファイル |
|---|---|---|
| 🟠 高 | **Render の Start Command を `./start.sh` に変更**（ダッシュボードで手動設定が必要） | Render Settings |
| 🟠 高 | **動作確認**（ログイン・新規登録のエンドツーエンドテスト） | - |
| 🟡 中 | 書類上部の店舗名・住所・電話番号を API（`/api/v1/stores`）から取得 | `invoice/page.tsx` |
| 🟡 中 | 宛名（顧客名）を車両/顧客 API から取得 | `invoice/page.tsx` |
| 🟡 中 | `InvoiceStatus` に `paid`/`cancelled` を追加 | `apps/api/app/schemas/work_report.py`, `workReports.ts` |
| 🟡 中 | フロント Sentry 再有効化（互換バージョン確認後） | `package.json`, `sentry.*.config.ts` |
| 🟡 中 | `src/components/cars/` 旧コンポーネント整理（未使用） | `car-form.tsx`, `car-filters.tsx` 等 |
| 🟡 中 | テストカバレッジ追加 | `apps/api/tests/` |
| 🟡 中 | Render 環境変数ドキュメント整備 | `README.md` |

---

## 必須環境変数（Render）

### API (vlp-api)
| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `SECRET_KEY` | JWT 署名キー |
| `SENTRY_DSN` | Sentry DSN（任意） |

### Web (vlp-web)
| 変数名 | 説明 |
|---|---|
| `API_BASE_URL` | FastAPI の URL（例: `https://vlp-api.onrender.com`） |
| `NEXT_PUBLIC_APP_URL` | フロントの URL（例: `https://vlp-web.onrender.com`）CSRF 用 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN（任意、Sentry 再有効化後） |

---

## 作業再開手順

```bash
# 最新取得
git pull

# 現在のコミット確認
git log --oneline -5

# TypeScript エラー確認
cd apps/web && npx tsc --noEmit

# Python 構文確認
cd apps/api && python -c "from app.main import app; print('OK')"
```
