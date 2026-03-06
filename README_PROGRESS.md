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
| 82 | `apps/api/app/schemas/work_report.py` | InvoiceUpdate.status に paid / cancelled を追加 | be0e0d6 |
| 83 | `apps/web/src/lib/api/workReports.ts` | InvoiceStatus 型に paid / cancelled を追加 | 8e62c3c |
| 84 | `apps/web/src/lib/api/stores.ts` | Store 型・listStores・getStore API クライアント新規作成 | 985d428 |
| 85 | `apps/web/src/lib/api/index.ts` | stores をバレル追加 | 9709753 |
| 86 | `apps/web/app/(app)/work-orders/[id]/invoice/page.tsx` | 店舗情報（名前・住所・TEL）・宛名（ownerName）をAPIから取得して表示 | 097aad4 |

### Phase 9: CSV インポート機能
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 87 | `apps/api/app/routes/import_csv.py` | CSV インポート API（テンプレート DL・車両・顧客 / dry_run・エンコード自動判定・バリデーション） | 56d1d1c |
| 88 | `apps/api/app/main.py` | import_csv ルーター登録 | f36fc9f |
| 89 | `apps/web/src/lib/api/importCsv.ts` | フロント API クライアント（ImportResult 型・downloadTemplate・uploadImportCsv） | 9aa3e21 |
| 90 | `apps/web/src/lib/api/index.ts` | importCsv をバレル追加 | 163b533 |
| 91 | `apps/web/app/(app)/import/page.tsx` | /import ページ（車両/顧客タブ・D&D・プレビュー・バリデーション色分け・実行） | d7c866e |
| 92 | `apps/web/app/_components/ClientNav.tsx` | ナビに「CSVインポート」リンク追加 | 17a6181 |

### Phase 10: 車両売上・利益管理
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 93 | `apps/api/app/routes/sales.py` | 車両ベース売上API（summary/monthly/by-car/by-staff/inventory-stats） | f53bed5 |
| 94 | `apps/api/app/main.py` | sales ルーター登録 | 29c91a6 |
| 95 | `apps/web/src/lib/api/sales.ts` + `index.ts` | フロント API クライアント・型定義 | 5f37ffe |
| 96 | `apps/web/app/(app)/sales/cars/page.tsx` | 車両売上ページ（月別棒グラフ・MoM比較・車両別/スタッフ別テーブル・在庫統計） | fd83f9e |
| 97 | `apps/web/app/_components/ClientNav.tsx` | 売上レポートメニューに「車両売上・利益」リンク追加 | 9f2974d |

### Phase 11: ライセンス・契約管理
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 98 | `apps/api/alembic/versions/20260305_08_create_licenses.py` | licenses テーブル作成 + superadmin ユーザー seed | 8d9613e |
| 99 | `apps/api/app/models/license.py` | LicenseORM モデル | 431be8f |
| 100 | `apps/api/app/schemas/license.py` | Pydantic スキーマ (Create/Update/Out) | feabef3 |
| 101 | `apps/api/app/routes/admin.py` | 管理者API（ライセンス一覧/発行/編集/停止） | 88a8abd |
| 102 | `apps/api/app/main.py` | admin ルーター登録 | cbe0c45 |
| 103 | `apps/web/src/lib/api/admin.ts` + `index.ts` | フロント API クライアント | 7e97509 |
| 104 | `apps/web/app/(app)/admin/licenses/page.tsx` | 契約店舗一覧ページ（フィルタ・ステータス色分け・編集ダイアログ・停止） | 7ebd8d7 |
| 105 | `apps/web/app/(app)/admin/licenses/new/page.tsx` | ライセンス発行ページ（店舗＋ユーザー作成・初期PW表示） | 7ebd8d7 |
| 106 | `apps/web/app/_components/ClientNav.tsx` | superadmin に「管理者」リンク追加 | 091ef67 |

### Phase 11 バグ修正: superadmin ログイン 401
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 107 | `apps/api/seed_superadmin.py` | 冪等 superadmin シードスクリプト（passlib を確実に使い CREATE/UPDATE） | a50e02f |
| 108 | `apps/api/start.sh` | マイグレーション後に seed_superadmin.py を実行するよう追加 | 7d8e06f |

**根本原因:** migration 20260305_08 内で passlib ハッシュ生成が except に落ちて `password_hash = ""` で INSERT → ログイン時 `not stored_hash` が True になり 401。
**修正内容:** seed スクリプトが起動毎に空ハッシュ/不正ロールを自動修復する。

| 109 | `apps/api/alembic/versions/20260305_09_users_store_id_nullable.py` | `users.store_id` の NOT NULL 制約を削除（superadmin は store_id = NULL） | b27c2d6 |

**根本原因2:** `users.store_id` に NOT NULL 制約が残存しており superadmin の NULL INSERT が失敗。
**修正内容:** idempotent マイグレーションで `ALTER TABLE users ALTER COLUMN store_id DROP NOT NULL`。

---

### Phase 12: パスワード変更・ライセンス延長
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 110 | `apps/api/app/routes/users.py` | PUT /api/v1/users/me/password エンドポイント追加（bcrypt検証・ハッシュ更新） | 3b72a15 |
| 111 | `apps/api/app/routes/admin.py` | PUT /api/v1/admin/licenses/{id}/extend エンドポイント追加（days / extend_to） | 2b438c5 |
| 112 | `apps/web/src/lib/api/admin.ts` | extendLicense API 関数追加 | acb1b63 |
| 113 | `apps/web/app/(app)/settings/page.tsx` | /settings ページ（プロフィール確認・パスワード変更リンク・店舗情報） | 7d7a144 |
| 114 | `apps/web/app/(app)/settings/password/page.tsx` | /settings/password ページ（バリデーション付きパスワード変更フォーム） | 682d4e2 |
| 115 | `apps/web/app/(app)/admin/licenses/page.tsx` | EditDialog に有効期限延長セクション追加（+30日/+90日/+1年・カスタム日付） | 3cd746f |
| 116 | `apps/web/app/_components/ClientNav.tsx` | ログアウトボタン → UserMenu ドロップダウン（設定・パスワード変更・ログアウト） | 2a5cd03 |

### Phase 13: UI改善
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 117 | `apps/web/app/globals.css` | ダークテーマ化（背景 #1e1e1e / カード #2a2a2a / テキスト白系）・`.vlp-bg-gray` を濃色に更新 | afb95fc |
| 118 | `apps/web/app/_components/ClientNav.tsx` | ナビハードコードカラーをダーク系に統一（#1e1e1e背景・#3a3a3aボーダー・ドロップダウン #2a2a2a） | c6f3d2c |
| 119 | `apps/web/app/_components/cars/carPresenters.ts` | 日本語ステータス対応（販売中/商談中/売約済み/整備中/入庫待ち）・`cardBorderClass`・`statusBadgeStyle` ヘルパー追加 | 62d4fd0 |
| 120 | `apps/web/app/_components/cars/CarCard.tsx` | ステータス別左ボーダー＋バッジスタイル適用（商談中:黄・売約済み:緑・整備中:橙・入庫待ち:グレー） | b95bf40 |
| 121 | `apps/web/app/(app)/masters/work/page.tsx` | 誤字修正: 「工賞」→「工賃」（5箇所） | 63f3aba |

### Phase 14: 代車管理・予約重複チェック
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 122 | alembic/versions/20260306_01_create_loaner_cars_and_reservations.py | loaner_cars + loaner_reservations テーブル作成マイグレーション | 749c9a3 |
| 123 | apps/api/app/models/loaner_car.py | LoanerCarORM・LoanerReservationORM モデル（relationship/cascade） | 798791c |
| 124 | apps/api/app/schemas/loaner_car.py | Pydantic スキーマ（Create/Update/Out・日付バリデーション） | 417ffe2 |
| 125 | apps/api/app/routes/loaner_cars.py | CRUD API + _check_overlap 重複チェック（同一代車で期間重複→400） | a90f744 |
| 126 | apps/api/app/main.py | loaner_cars ルーター登録 | 42e8339 |
| 127 | apps/web/src/lib/api/loanerCars.ts | フロント API クライアント + findOverlappingReservations クライアント側チェック関数 | 861d2e5 |
| 128 | apps/web/src/lib/api/index.ts | loanerCars をバレル追加 | 2d48f45 |
| 129 | apps/web/app/(app)/loaner/page.tsx | 代車管理ページ（代車CRUD・予約一覧・予約フォーム・重複警告バナー） | ad58765 |
| 130 | apps/web/app/_components/ClientNav.tsx | ナビに「代車管理」リンク追加 | 4761b9e |

**重複チェック仕様:**
- バックエンド: start_date <= new_end AND end_date >= new_start で既存予約を検索→ヒットで 400
- フロントエンド: 予約フォームで代車・日付を変更するたびにリアルタイムチェック→重複があれば黄色警告バナー表示（送信はブロックしない）

### Phase 15: 整備記録簿
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 131 | apps/web/app/(app)/maintenance-records/page.tsx | 整備記録簿ページ（完了済み作業報告書を月別グループ表示・全文検索・作業/部材件数・合計金額表示） | 9f97aac |
| 132 | apps/web/app/_components/ClientNav.tsx | ナビに「整備記録簿」リンク追加 | 82b38d1 |

### Phase 16: 経費ページ改善・カテゴリ管理
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 133 | `apps/api/app/routes/expenses.py` | `ExpenseOut` に `attachment_count` フィールド追加・`list_expenses` で GROUP BY 一括取得（N+1回避） | b723a86 |
| 134 | `apps/api/app/routes/masters.py` | `DELETE /master/expense-categories/{id}` 追加（is_system=true は 400） | 8431fde |
| 135 | `apps/web/app/(app)/sales/expenses/page.tsx` | 月次サマリーカード・カテゴリカラーバッジ・添付アイコン（ReceiptCell 統合）・ライトテーマクラス除去 | 9f14cc1 |
| 136 | `apps/web/app/(app)/masters/expense-categories/page.tsx` | 経費カテゴリ管理ページ新規作成（プリセット一覧・カスタム追加/削除/上下並び替え） | 2c3249c |

### Phase 17: SNS自動投稿（車両登録・値下げ・SOLD OUT・定期再投稿）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 137 | `apps/api/alembic/versions/20260306_02_create_sns_tables.py` | sns_settings + sns_posts テーブル作成マイグレーション | c5cb977 |
| 138 | `apps/api/app/models/sns_post.py` | SnsSettingORM・SnsPostORM モデル | 66694a8 |
| 139 | `apps/api/app/schemas/sns.py` | Pydantic スキーマ（SnsSettingOut/Update・SnsPostOut/Create・RepostScheduleItem） | cb3452b |
| 140 | `apps/api/app/services/sns_service.py` | SNS投稿サービス（generate_caption・Twitter OAuth1・Instagram Graph API・LINE Messaging API・repost scheduling） | 21b5646 |
| 141 | `apps/api/app/routes/sns.py` | SNS API ルート（settings GET/PUT・posts GET/POST・retry・preview・repost-schedule・trigger） | 0ae4320 |
| 142 | `apps/api/app/main.py` | sns ルーター登録 | 9b5247b |
| 143 | `apps/web/src/lib/api/sns.ts` | フロント API クライアント・型定義 | 2a9c92b |
| 144 | `apps/web/src/lib/api/index.ts` | sns バレル追加 | b029d71 |
| 145 | `apps/web/app/(app)/masters/sns/page.tsx` | SNS管理ページ（設定/投稿履歴/定期再投稿 3タブ構成） | a167657 |
| 146 | `apps/web/app/_components/ClientNav.tsx` | ナビに「SNS投稿」リンク追加 | 43c30c0 |

**仕様まとめ:**
- **バックエンド**: Twitter v2 API（OAuth 1.0a 手動署名）・Instagram Graph API・LINE Messaging API broadcast をすべてhttpx HTTPSリクエストで実装（SDK不要）
- **自動トリガー**: `POST /sns/trigger` に new_arrival / price_down / sold_out を渡すと auto_* フラグを確認して自動投稿（無効なら skipped）
- **テンプレート変数**: `{car_name}` `{year}` `{mileage}` `{price}` `{store_name}` `{color}` `{comment}`
- **定期再投稿**: repost_enabled=true かつ last_posted_at から repost_interval_weeks 週超過した販売中車両を自動検出（SOLD ステータスはスキップ）
- **repost_count**: 何回目の再投稿かを sns_posts に記録

### Phase 18: 勤怠管理（GPS打刻・管理者一覧）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 147 | `apps/api/alembic/versions/20260306_03_create_attendance.py` | attendance テーブル作成（store_id/user_id/work_date 一意制約・GPS座標カラム） | 6f5c496 |
| 148 | `apps/api/app/models/attendance.py` | AttendanceORM モデル | d86961a |
| 149 | `apps/api/app/schemas/attendance.py` | Pydantic スキーマ（AttendanceOut/Update・ClockIn/OutRequest） | 219a0b0 |
| 150 | `apps/api/app/routes/attendance.py` | 出退勤打刻・一覧・管理者修正/削除 API | b9365fd |
| 151 | `apps/api/app/main.py` | attendance ルーター登録 | eb7e8e2 |
| 152 | `apps/web/src/lib/api/attendance.ts` | フロント API クライアント（GPS取得・Nominatim逆ジオコーディング・勤務時間計算） | 95ebf12 |
| 153 | `apps/web/src/lib/api/index.ts` | attendance バレル追加 | b11f5cf |
| 154 | `apps/web/app/(app)/attendance/punch/page.tsx` | スタッフ打刻ページ（リアルタイム時計・出退勤ボタン・GPS住所表示） | a799200 |
| 155 | `apps/web/app/(app)/attendance/page.tsx` | 管理者勤怠一覧ページ（スタッフ別サマリー・インライン編集・削除） | ec1e3c1 |
| 156 | `apps/web/app/_components/ClientNav.tsx` | 勤怠管理リンク追加（管理者→一覧、スタッフ→打刻ページ） | 6227c2b |

**仕様まとめ:**
- **1ユーザー1日1レコード**（store_id + user_id + work_date に UNIQUE 制約）
- **JST基準**: 打刻日の決定は UTC+9 で today を計算
- **GPS**: `navigator.geolocation.getCurrentPosition()` → 拒否時は位置情報なしで打刻可（任意）
- **Nominatim**: `https://nominatim.openstreetmap.org/reverse` で座標→日本語住所に変換（無料）
- **権限分岐**: admin/manager → `/attendance`（一覧・修正・削除）、staff → `/attendance/punch`（打刻のみ）
- **スタッフ自分限定**: GET /attendance でスタッフロールは自動的に自分のレコードのみ返す

### Phase 19: 管理者機能強化・ステータスカラーカスタマイズ
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 157 | `apps/api/app/routes/admin.py` | GET /admin/dashboard（統計API）+ GET/DELETE /admin/invites（全店舗招待一覧）追加 | d7c54ab |
| 158 | `apps/web/app/(app)/admin/dashboard/page.tsx` | 管理ダッシュボード（店舗数/ユーザー数/ライセンス状態別/期限切れ間近・クイックリンク） | 2fa2302 |
| 159 | `apps/web/app/(app)/admin/invites/page.tsx` | 紹介管理ページ（全店舗招待コード一覧・検索・コピー・削除・期限切れグレーアウト） | d9c1f58 |
| 160 | `apps/web/app/(app)/masters/car-status-colors/page.tsx` | ステータスカラー管理ページ（カラーピッカー・リアルタイムプレビュー・デフォルトに戻す・保存） | d7103c3 |
| 161 | `apps/web/app/_components/cars/CarCard.tsx` | statusColorMap? prop 追加・API色でborder/badgeを描画（フォールバック: トーンベース） | 868f340 |
| 162 | `apps/web/app/_components/ClientNav.tsx` | adminメニューを単一NavLink → AdminMenu ドロップダウンに変更（管理ダッシュボード・ライセンス管理・紹介管理） | dcd82aa |

**仕様まとめ:**
- **管理ダッシュボード**: superadmin が全店舗の統計を一覧。30日以内に期限切れのライセンスを警告色で強調
- **紹介管理**: 全店舗の招待コードを横断表示。使用済み/期限切れコードはグレーアウト
- **カラーカスタマイズ**: `<input type="color">` で選択 → 即時プレビュー（左ボーダー＋バッジ）→ 変更分のみ PUT で保存。デフォルト色への個別/全体リセット対応
- **CarCard API色対応**: `statusColorMap` プロパティで渡すと `car.status` 名でマッチング → hex色からborder/badge styleを自動生成

### Phase 20: 請求書・領収書発行（ライセンス料）・年払い対応
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 163 | `apps/api/alembic/versions/20260306_04_create_license_invoices.py` | license_invoicesテーブル作成・licensesにbilling_cycle/next_billing_date追加 | 7f59b6a |
| 164 | `apps/api/app/models/license_invoice.py` | LicenseInvoiceORM モデル（INV-YYYY-NNNN・type・billing_cycle・消費税分離） | ba66d11 |
| 165 | `apps/api/app/models/license.py` | billing_cycle / next_billing_date カラム追加 | 1f26cec |
| 166 | `apps/api/app/schemas/license_invoice.py` | Pydantic スキーマ（Create/Out）+ PLAN_PRICES定数（月額/年額）+ TAX_RATE | 58871a7 |
| 167 | `apps/api/app/routes/license_invoice.py` | CRUD API（list/create/get/paid/cancel）+ /store-invoices 店舗向け閲覧 | 3cc539a |
| 168 | `apps/api/app/main.py` | license_invoice / store_invoice ルーター登録 | 5e073d0 |
| 169 | `apps/web/src/lib/api/licenseInvoice.ts` + `index.ts` | フロント API クライアント・型定義・PLAN_PRICES定数 | fc42011 |
| 170 | `apps/web/app/(app)/admin/invoices/page.tsx` | 請求書管理ページ（一覧・ステータス色分け・発行ダイアログ・支払済みマーク） | 9500584 |
| 171 | `apps/web/app/(app)/admin/invoices/[id]/print/page.tsx` | PDF印刷ページ（A4縦・発行者/宛名/明細/消費税/振込先・領収書モード・収入印紙欄） | 08a027d |
| 172 | `apps/web/app/(app)/settings/invoices/page.tsx` | 店舗向け請求書確認ページ（一覧・PDF印刷・年払いアップセルバナー） | e1966c2 |
| 173 | `apps/web/app/_components/ClientNav.tsx` | AdminMenu: 請求書管理リンク追加 / UserMenu: 請求書確認リンク追加 | bd0e398 |

**仕様まとめ:**
- **書類種別**: invoice（請求書）/ receipt（領収書）を発行時に選択
- **年払い料金（10%割引）**: スターター 105,840円/年・スタンダード 213,840円/年・プロ 321,840円/年
- **INV-YYYY-NNNN**: 同年内連番で自動採番
- **消費税**: バックエンドで10%を自動計算（amount × 0.1）
- **収入印紙欄**: 領収書で合計5万円以上の場合に印刷レイアウトに表示
- **年払いバナー**: 店舗ページで月払い利用中の場合に割引額・節約額を強調表示
- **権限**: /admin/license-invoices は superadmin 専用・/store-invoices は全ロール（自店舗のみ）

### Phase 21: Stripe連携・紹介制度・パートナー制度・ローン/保証/保険機能フラグ
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 174 | `apps/api/requirements.txt` | stripe>=10.0 追加 | 前フェーズ |
| 175 | `apps/api/alembic/versions/20260306_05_create_partners_referrals_stripe.py` | partners / referrals テーブル + stores.own_referral_code + licenses Stripe/紹介カラム | 前フェーズ |
| 176 | `apps/api/alembic/versions/20260306_06_add_integration_flags_to_store_settings.py` | store_settings にローン/保証/保険 enabled+url+company_name 追加 | 前フェーズ |
| 177 | `apps/api/app/models/partner.py` | PartnerORM（code自動生成、rank、loan/warranty/insurance type） | 前フェーズ |
| 178 | `apps/api/app/models/referral.py` | ReferralORM（status: pending/active/cancelled、activated_at） | 前フェーズ |
| 179 | `apps/api/app/models/license.py` | referral_code / referral_discount / partner_id / stripe_* カラム追加 | 前フェーズ |
| 180 | `apps/api/app/models/store.py` | own_referral_code カラム追加 | 前フェーズ |
| 181 | `apps/api/app/models/store_setting.py` | loan/warranty/insurance enabled + url + company_name カラム追加 | 前フェーズ |
| 182 | `apps/api/app/schemas/partner.py` | PartnerCreate/Update/Out + RANK_THRESHOLDS定数 | 前フェーズ |
| 183 | `apps/api/app/schemas/referral.py` | ReferralOut / MyDiscountOut + REFERRAL_DISCOUNT_PER_ACTIVE=1000 | 前フェーズ |
| 184 | `apps/api/app/routes/partner.py` | 管理CRUD + stats取得 + rank自動昇格 (superadmin専用) | 前フェーズ |
| 185 | `apps/api/app/routes/referral.py` | 紹介一覧/手動有効化/自分のコード取得・生成/割引計算 | 前フェーズ |
| 186 | `apps/api/app/routes/stripe_webhook.py` | Webhook処理（subscription作成/削除・payment_succeeded→90日後紹介有効化） | 前フェーズ |
| 187 | `apps/api/app/routes/stripe_payment.py` | checkout-session / portal-session / subscription-status（モック対応） | 前フェーズ |
| 188 | `apps/api/app/routes/integrations.py` | GET/PUT /integrations（ローン/保証/保険設定） | 前フェーズ |
| 189 | `apps/api/app/main.py` | partner/referral/stripe_webhook/stripe_payment/integrations ルーター登録 | 前フェーズ |
| 190 | `apps/web/src/lib/api/partner.ts` + `index.ts` | パートナーAPIクライアント・RANK_LABELS/RANK_COLORS定数 | 前フェーズ |
| 191 | `apps/web/src/lib/api/referral.ts` | 紹介APIクライアント・REFERRAL_DISCOUNT_PER_ACTIVE=1000 | 前フェーズ |
| 192 | `apps/web/src/lib/api/stripe.ts` | Stripe checkout/portal/status APIクライアント | 前フェーズ |
| 193 | `apps/web/src/lib/api/integrations.ts` | 統合設定APIクライアント | 前フェーズ |
| 194 | `apps/web/app/(app)/admin/partners/page.tsx` | パートナー管理ページ（一覧・作成・編集・削除） | 前フェーズ |
| 195 | `apps/web/app/(app)/admin/partners/[id]/page.tsx` | パートナー詳細（stats・rank・紹介店舗テーブル） | 前フェーズ |
| 196 | `apps/web/app/(app)/settings/referral/page.tsx` | 紹介・割引ページ（コード表示・コピー・割引サマリー・紹介店舗一覧） | f117e58 |
| 197 | `apps/web/app/(app)/settings/billing/page.tsx` | 料金・決済ページ（プラン表示・紹介割引・年払いアップセル・Stripeポータル） | 11a76e2 |
| 198 | `apps/web/app/(app)/masters/integrations/page.tsx` | ローン/保証/保険設定ページ（ON/OFFトグル・URL・会社名入力） | 753029e |
| 199 | `apps/web/app/cars/[id]/CarDetailClient.tsx` | 車両詳細にローン/保証/保険申込ボタン追加（外部リンクのみ・法的安全） | 2d242d5 |
| 200 | `apps/web/app/_components/ClientNav.tsx` | AdminMenu: パートナー管理 / MastersMenu: ローン/保証/保険設定 / UserMenu: 紹介・割引・料金・決済 | cb8ffbd |

**仕様まとめ:**
- **紹介コード**: VLP-XXXXXXXX形式（VLP- + 8文字英数字大文字）、未生成時は自動生成
- **紹介割引**: 有効紹介1件につき¥1,000/月（上限なし）、月額から直接減算
- **3ヶ月自動有効化**: Stripe payment_succeeded webhook で created_at から90日経過確認
- **パートナーランク**: silver(3件以上)・gold(10件以上)・platinum(20件以上) 自動昇格
- **Stripeモック**: STRIPE_SECRET_KEY未設定時はモックレスポンスで動作（本番設定まで無停止）
- **申込ボタン**: ローン/保証/保険は外部URLリンクのみ。説明・比較なし（法的安全）
- **環境変数**: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_ID_* / FRONTEND_URL

### Phase 22: PWA対応（オフライン・インストール・プッシュ通知）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 201 | `apps/web/public/manifest.json` | Webアプリマニフェスト（name/icon/display/theme_color） | 5464e47 |
| 202 | `apps/web/scripts/generate-icons.js` + `public/icons/*.png` | 純Node.jsアイコン生成スクリプト + 8サイズPNG（72〜512px） | 97c46fb |
| 203 | `apps/web/public/sw.js` | Service Worker（Network First・事前キャッシュ・Push通知受信・通知クリックナビ） | b658ffe |
| 204 | `apps/web/app/layout.tsx` | manifest link / theme-color / apple-mobile-web-app-* / viewport-fit=cover | f93bfb5 |
| 205 | `apps/web/app/_components/PwaInstallPrompt.tsx` | インストールバナー（Android: beforeinstallprompt / iOS: 共有ボタン案内 / sessionStorage非表示） | 9485168 |
| 206 | `apps/web/app/_components/ServiceWorkerRegistration.tsx` | SW登録・更新検知・「今すぐ更新」トースト | bb9aed1 |
| 207 | `apps/web/app/(app)/layout.tsx` | ServiceWorkerRegistration + PwaInstallPrompt をアプリレイアウトに追加 | 2e15591 |
| 208 | `apps/web/next.config.ts` | sw.js に Service-Worker-Allowed/no-cache、manifest.json に Content-Type ヘッダー | 6d0ada2 |
| 209 | `apps/api/app/models/push_subscription.py` + migration | PushSubscriptionORM（endpoint/p256dh/auth/user_id/store_id） | b748033 |
| 210 | `apps/api/app/routes/push_notification.py` + requirements.txt | POST /push/subscribe・DELETE /push/unsubscribe・POST /push/send / pywebpush>=2.0 | 9dfde07 |
| 211 | `apps/api/app/routes/work_reports.py` + loaner_cars.py | 通知トリガー: 新規整備依頼作成時・代車返却期限当日 | cbb67a8 |
| 212 | `apps/api/.env.example` | VAPID_PUBLIC_KEY/PRIVATE_KEY/EMAIL のサンプル + 生成方法コメント | d9aa6e5 |
| 213 | `apps/api/app/main.py` | push_notification_router 登録 | 5346d2c |
| 214 | `apps/web/app/globals.css` | safe-area-inset padding / スクロールバー非表示 / tap-highlight無効化 | cc5c3f0 |

**仕様まとめ:**
- **Service Worker**: Network First戦略（GET のみキャッシュ・POST/PUT/DELETE はスキップ）。古いキャッシュは activate 時に自動削除
- **インストールバナー**: Android/Chrome → beforeinstallprompt イベント → ネイティブインストール。iOS → 共有ボタン案内。sessionStorage で「後で」が効く
- **更新トースト**: SW の waiting 状態を検知 → 「今すぐ更新」で SKIP_WAITING → controllerchange でページリロード
- **プッシュ通知**: VAPID鍵必須（未設定時はサイレント無視）。pywebpush で WebPush送信。endpoint 410 Gone 受信時は購読を自動削除
- **通知トリガー**: 新規整備依頼（work_reports POST）・代車返却当日（loaner-reservations POST で end_date == today）
- **スマホ最適化**: viewport-fit=cover + safe-area-inset-bottom でノッチ・ホームバー対応。-webkit-tap-highlight-color: transparent

### Phase 23: LINE連携（顧客通知・問い合わせ対応）
| # | ファイル | 内容 | コミット |
|---|---|---|---|
| 215 | `apps/api/app/models/line_setting.py` + `line_customer.py` + `line_message.py` + migration | LineSettingORM / LineCustomerORM / LineMessageORM + `20260306_08_create_line_tables.py` | bf842a8 |
| 216 | `apps/api/app/services/line_service.py` | verify_signature / send_message / reply / broadcast / send_flex_message / get_profile + Flex Messageテンプレート3種 | b16a8ce |
| 217 | `apps/api/app/routes/line_webhook.py` | POST /line/webhook（follow/unfollow/message 処理・署名検証・自動返信・PWAプッシュ通知） | 3af7dd2 |
| 218 | `apps/api/app/routes/line.py` | GET/PUT /line/settings, POST /line/settings/test, GET /line/customers, PUT /line/customers/{id}/link, GET /line/messages, POST /line/messages/send・broadcast, POST /line/notify/work-order・estimate | c0f0472 |
| 219 | `apps/api/app/main.py` + `.env.example` | line_webhook_router / line_router 登録、LINE_CHANNEL_ACCESS_TOKEN 環境変数追加 | 62c0b37 |
| 220 | `apps/web/src/lib/api/line.ts` + `index.ts` | LINE APIクライアント・型定義（設定/顧客/メッセージ/通知） | 69aa2cc |
| 221 | `apps/web/app/(app)/masters/line/page.tsx` | LINE設定ページ（Channel Token/Secret/LIFF・Webhook URL表示+コピー・接続テスト・自動返信・ウェルカムメッセージ） | 305da8e |
| 222 | `apps/web/app/(app)/line/page.tsx` | LINE管理ページ（友だち一覧タブ・チャット形式メッセージタブ・一斉送信タブ） | 90aebbe |
| 223 | `apps/web/app/_components/ClientNav.tsx` | MastersMenu: LINE設定 / ナビ: LINE管理 追加 | 136911b |

**仕様まとめ:**
- **Webhook URL**: `/api/v1/line/webhook?store_id={store_uuid}` 形式。店舗ごとに固有URL
- **署名検証**: HMAC-SHA256 で X-Line-Signature を検証（セキュリティ必須。channel_secret 未設定時は警告のみ）
- **フォローイベント**: LINE プロフィール取得 → line_customers upsert → ウェルカムメッセージ送信 → PWAプッシュ通知
- **アンフォロー**: follow_status を blocked に更新
- **受信メッセージ**: line_messages に保存 → 自動返信（enabled 時）→ PWAプッシュ通知
- **Flex Message**: 整備完了・見積送付・入庫受付の3テンプレートを辞書型で実装（外部SDK不要）
- **顧客紐付け**: LINE顧客 ↔ 既存顧客を customer_id FK で関連付け（任意）
- **環境変数**: LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET（DB の line_settings で店舗別管理が主）

## 未対応 / 今後の課題

| 優先度 | 内容 | 対象ファイル |
|---|---|---|
| 🟠 高 | **Render の Start Command を `./start.sh` に変更**（ダッシュボードで手動設定が必要） | Render Settings |
| 🟠 高 | **動作確認**（ログイン・新規登録のエンドツーエンドテスト） | - |
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
| `STRIPE_SECRET_KEY` | Stripe シークレットキー（任意・未設定時はモック） |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名シークレット（任意） |
| `STRIPE_PRICE_ID_STARTER_MONTHLY` | Stripe Price ID: スターター月払い |
| `STRIPE_PRICE_ID_STANDARD_MONTHLY` | Stripe Price ID: スタンダード月払い |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Stripe Price ID: プロ月払い |
| `STRIPE_PRICE_ID_STARTER_YEARLY` | Stripe Price ID: スターター年払い |
| `STRIPE_PRICE_ID_STANDARD_YEARLY` | Stripe Price ID: スタンダード年払い |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Stripe Price ID: プロ年払い |
| `FRONTEND_URL` | フロントURL（CORS許可リスト追加用） |

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
