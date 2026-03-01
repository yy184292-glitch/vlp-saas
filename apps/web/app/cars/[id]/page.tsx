"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApiError, Car, getCar, listCarValuations, updateCar } from "@/src/lib/api";

type Params = { id: string };

type TabKey = "details" | "valuations";

function formatYen(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  try {
    return new Intl.NumberFormat("ja-JP").format(n);
  } catch {
    return String(n);
  }
}

function sanitizeMoneyInput(raw: string): string {
  // 数字とカンマのみ許可（全角→半角、空白除去）
  const half = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return half.replace(/[^\d,]/g, "").replace(/,{2,}/g, ",");
}

function parseMoneyOrNull(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  // 金額は整数想定（必要なら小数許可に変更）
  return Math.floor(n);
}

function isBackendUpdateUnsupported(err: unknown): boolean {
  if (err instanceof ApiError) {
    // よくある: 未実装(404), method not allowed(405), エンドポイント未公開(501等)
    return [404, 405, 501].includes(err.status);
  }
  return false;
}

export default function CarDetailPage({ params }: { params: Params }) {
  const carId = params.id;

  const [tab, setTab] = useState<TabKey>("details");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [car, setCar] = useState<Car | null>(null);
  const [valuations, setValuations] = useState<
    Array<{
      id: string;
      storeId: string;
      buyPrice: number;
      sellPrice: number;
      profit: number;
      profitRate: number;
      valuationAt: string;
      createdAt: string;
    }>
  >([]);

  // 入力UI（文字列で保持）
  const [purchasePriceText, setPurchasePriceText] = useState("");
  const [salePriceText, setSalePriceText] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveUnsupported, setSaveUnsupported] = useState(false);

  const dirty = useMemo(() => {
    if (!car) return false;
    const p = parseMoneyOrNull(purchasePriceText);
    const s = parseMoneyOrNull(salePriceText);
    return p !== (car.purchasePrice ?? null) || s !== (car.salePrice ?? null);
  }, [car, purchasePriceText, salePriceText]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const c = await getCar(carId);
        if (cancelled) return;
        setCar(c);

        setPurchasePriceText(c.purchasePrice !== null ? formatYen(c.purchasePrice) : "");
        setSalePriceText(c.salePrice !== null ? formatYen(c.salePrice) : "");

        // 査定履歴は失敗しても致命ではないので個別try
        try {
          const v = await listCarValuations(carId, { limit: 50, offset: 0 });
          if (!cancelled) setValuations(v);
        } catch {
          if (!cancelled) setValuations([]);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "読み込みに失敗しました";
        setErrorMessage(msg);
        setCar(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [carId]);

  async function onSave() {
    if (!car) return;
    if (saveUnsupported) return;

    setSaving(true);
    setErrorMessage(null);

    const purchase_price = parseMoneyOrNull(purchasePriceText);
    const sale_price = parseMoneyOrNull(salePriceText);

    try {
      const updated = await updateCar(car.id, { purchase_price, sale_price });
      setCar(updated);
      setPurchasePriceText(updated.purchasePrice !== null ? formatYen(updated.purchasePrice) : "");
      setSalePriceText(updated.salePrice !== null ? formatYen(updated.salePrice) : "");
    } catch (e) {
      if (isBackendUpdateUnsupported(e)) {
        setSaveUnsupported(true);
        setErrorMessage("保存APIがまだ未対応のため、この環境では保存できません（UIは先行実装）。");
        return;
      }
      const msg = e instanceof Error ? e.message : "保存に失敗しました";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">車両詳細</h1>
          <p className="mt-1 text-sm text-neutral-500">ID: {carId}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setTab("details")}
            disabled={tab === "details"}
          >
            車両情報
          </button>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setTab("valuations")}
            disabled={tab === "valuations"}
          >
            査定履歴
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600">読み込み中…</div>
      ) : !car ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600">車両データがありません。</div>
      ) : tab === "details" ? (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-neutral-500">車種</div>
              <div className="mt-1 text-base font-medium">
                {[car.make, car.model, car.grade].filter(Boolean).join(" ")}
              </div>
              <div className="mt-2 text-sm text-neutral-500">状態</div>
              <div className="mt-1 text-sm">{car.status ?? "-"}</div>
              <div className="mt-2 text-sm text-neutral-500">登録番号</div>
              <div className="mt-1 text-sm">{car.carNumber ?? "-"}</div>
              <div className="mt-2 text-sm text-neutral-500">VIN</div>
              <div className="mt-1 text-sm">{car.vin ?? "-"}</div>
              <div className="mt-2 text-sm text-neutral-500">年式 / 走行</div>
              <div className="mt-1 text-sm">
                {(car.year ?? "-") + " / " + (car.mileage !== null ? `${formatYen(car.mileage)} km` : "-")}
              </div>
            </div>

            <div className="rounded-xl border bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium">仕入れ値 / 売却値</div>
                <button
                  type="button"
                  className="rounded-lg bg-black px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onSave}
                  disabled={saving || !dirty || saveUnsupported}
                  title={saveUnsupported ? "保存API未対応" : undefined}
                >
                  {saveUnsupported ? "保存未対応" : saving ? "保存中…" : "保存"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <div className="text-xs text-neutral-600">仕入れ値（円）</div>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring"
                    value={purchasePriceText}
                    onChange={(e) => setPurchasePriceText(sanitizeMoneyInput(e.target.value))}
                    placeholder="例: 1,200,000"
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    現在: {formatYen(car.purchasePrice)} 円
                  </div>
                </label>

                <label className="block">
                  <div className="text-xs text-neutral-600">売却値（円）</div>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring"
                    value={salePriceText}
                    onChange={(e) => setSalePriceText(sanitizeMoneyInput(e.target.value))}
                    placeholder="例: 1,450,000"
                  />
                  <div className="mt-1 text-xs text-neutral-500">
                    現在: {formatYen(car.salePrice)} 円
                  </div>
                </label>

                <div className="mt-2 rounded-lg border bg-white px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">差額（売却 - 仕入れ）</span>
                    <span className="font-medium">
                      {(() => {
                        const p = parseMoneyOrNull(purchasePriceText);
                        const s = parseMoneyOrNull(salePriceText);
                        if (p === null || s === null) return "-";
                        return `${formatYen(s - p)} 円`;
                      })()}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    ※ 査定（expected）とは別の「実入力値」です。
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">直近査定（expected）</div>
              <div className="mt-2 text-sm text-neutral-700">
                仕入れ上限: {formatYen(car.expectedBuyPrice)} / 推奨売価: {formatYen(car.expectedSellPrice)}
              </div>
              <div className="mt-1 text-sm text-neutral-700">
                期待利益: {formatYen(car.expectedProfit)}（{car.expectedProfitRate !== null ? `${car.expectedProfitRate}%` : "-"}）
              </div>
              <div className="mt-1 text-xs text-neutral-500">査定日時: {car.valuationAt ?? "-"}</div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="text-sm font-medium">更新情報</div>
              <div className="mt-2 text-sm text-neutral-700">作成: {car.createdAt ?? "-"}</div>
              <div className="mt-1 text-sm text-neutral-700">更新: {car.updatedAt ?? "-"}</div>
              <div className="mt-3 text-xs text-neutral-500">
                保存ボタンが「保存未対応」になる場合は、バックエンド側のPATCHが未実装です。
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-medium">査定履歴</div>

          {valuations.length === 0 ? (
            <div className="text-sm text-neutral-600">査定履歴はありません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left text-neutral-500">
                    <th className="py-2 pr-4 font-medium">査定日</th>
                    <th className="py-2 pr-4 font-medium">店舗</th>
                    <th className="py-2 pr-4 font-medium">仕入れ</th>
                    <th className="py-2 pr-4 font-medium">売却</th>
                    <th className="py-2 pr-4 font-medium">利益</th>
                    <th className="py-2 pr-4 font-medium">利益率</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((v) => (
                    <tr key={v.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{v.valuationAt}</td>
                      <td className="py-2 pr-4">{v.storeId}</td>
                      <td className="py-2 pr-4">{formatYen(v.buyPrice)}</td>
                      <td className="py-2 pr-4">{formatYen(v.sellPrice)}</td>
                      <td className="py-2 pr-4">{formatYen(v.profit)}</td>
                      <td className="py-2 pr-4">{Number.isFinite(v.profitRate) ? `${v.profitRate}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}