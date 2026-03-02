# vlp-saas
Monorepo: Next.js (web) + FastAPI (api) + Worker (ocr/ai/csv)


## 外部相場（平均価格）API: MarketCheck

- API側 `.env` に `MARKETCHECK_API_KEY` を設定してください。
- 査定設定（/masters/settings から変更）に以下を追加：
  - market_zip（US ZIP）
  - market_radius_miles
  - market_miles_band（走行距離の±幅）
  - market_car_type（used/new/certified など）
  - market_currency（既定 USD）
  - market_fx_rate（既定 150: USD→JPY 換算）

