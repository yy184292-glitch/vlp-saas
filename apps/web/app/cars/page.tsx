"use client";

import { useEffect, useMemo, useState } from "react";
import type { Car, CarValuation, ValuationCalculateResult } from "@/lib/api";
import { calculateValuation, createCar, deleteCar, listCars, listCarValuations } from "@/lib/api";

function formatText(v: string | null | undefined) {
  return v && v.trim() ? v : "-";
}
function formatYear(v: number | null | undefined) {
  return v !== null && v !== undefined ? String(v) : "-";
}
function fmtYen(n: number) {
  return `¥${n.toLocaleString()}`;
}
function fmtPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}
function toMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}
function contains(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase());
}
function carLabel(c: Car): string {
  const parts = [
    c.stockNo ?? "",
    c.make ?? "",
    c.maker ?? "",
    c.model ?? "",
    c.grade ?? "",
    c.vin ?? "",
    c.modelCode ?? "",
  ];
  return parts.join(" ").trim();
}

type SortKey = "updated_desc" | "updated_asc" | "year_desc" | "year_asc" | "profit_desc" | "profit_asc" | "profit_rate_desc" | "profit_rate_asc";

export default function CarsPage() {
  // 取得した全件（上限あり）
  const [allCars, setAllCars] = useState<Car[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // UX controls
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated_desc");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const [tab, setTab] = useState<"info" | "valuations">("info");
  const [valuations, setValuations] = useState<CarValuation[]>([]);
  const [valuationsLoading, setValuationsLoading] = useState(false);
  const [selectedValuation, setSelectedValuation] = useState<CarValuation | null>(null);

  // 計算モーダル
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");
  const [calcResult, setCalcResult] = useState<ValuationCalculateResult | null>(null);

  const selectedCar = useMemo(
    () => (selectedId ? allCars.find((c) => c.id === selectedId) ?? null : null),
    [allCars, selectedId]
  );

  const loadAllCars = async () => {
    setError("");
    setLoading(true);
    try {
      const LIMIT = 100;
      const MAX_TOTAL = 500; // 念のため上限（必要なら上げる）
      let offset = 0;
      let items: Car[] = [];
      let total = 0;

      while (true) {
        const res = await listCars({ limit: LIMIT, offset });
        total = res.meta.total ?? total;
        items = items.concat(res.items);

        offset += LIMIT;

        if (items.length >= total) break;
        if (items.length >= MAX_TOTAL) break;
      }

      setAllCars(items);
      if (selectedId && !items.some((c) => c.id === selectedId)) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllCars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索/ソート変更時はページを1に戻す
  useEffect(() => {
    setPage(1);
  }, [query, sort, pageSize]);

  // 車の選択が変わったら履歴を取り直す
  useEffect(() => {
    if (!selectedId) {
      setValuations([]);
      setSelectedValuation(null);
      return;
    }

    (async () => {
      setError("");
      setValuationsLoading(true);
      try {
        const items = await listCarValuations(selectedId, { limit: 50, offset: 0 });
        setValuations(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load valuations");
      } finally {
        setValuationsLoading(false);
      }
    })();
  }, [selectedId]);

  useEffect(() => {
    setTab("info");
  }, [selectedId]);

  const onCreate = async () => {
    setError("");

    const input = {
      stock_no: `demo_${Date.now()}`,
      make: "toyota",
      model: "prius",
      year: 2020,
      mileage: 50000,
    };

    try {
      const created = await createCar(input);
      // 先頭に追加して選択（検索・ソートは後で適用される）
      setAllCars((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const onDeleteSelected = async () => {
    if (!selectedCar) return;

    const ok = window.confirm("本当に削除しますか？この操作は取り消せません。");
    if (!ok) return;

    setError("");
    try {
      await deleteCar(selectedCar.id);
      setAllCars((prev) => prev.filter((c) => c.id !== selectedCar.id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const closeCalcModal = () => {
    setCalcOpen(false);
    setCalcLoading(false);
    setCalcError("");
    setCalcResult(null);
  };

  const onCalculate = async () => {
    if (!selectedCar) return;

    const make = (selectedCar.make ?? selectedCar.maker ?? "").trim();
    const model = (selectedCar.model ?? "").trim();
    const grade = (selectedCar.grade ?? "").trim();
    const year = typeof selectedCar.year === "number" ? selectedCar.year : 0;
    const mileage = typeof selectedCar.mileage === "number" ? selectedCar.mileage : 0;

    setCalcOpen(true);
    setCalcLoading(true);
    setCalcError("");
    setCalcResult(null);

    try {
      const res = await calculateValuation({ make, model, grade, year, mileage });
      setCalcResult(res);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : "Failed to calculate valuation");
    } finally {
      setCalcLoading(false);
    }
  };

  const filteredSortedCars = useMemo(() => {
    const q = query.trim();
    let list = allCars;

    if (q) {
      list = list.filter((c) => contains(carLabel(c), q));
    }

    const cmpNum = (a: number | null, b: number | null) => (a ?? -Infinity) - (b ?? -Infinity);

    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "updated_desc":
          return toMs(b.updatedAt) - toMs(a.updatedAt);
        case "updated_asc":
          return toMs(a.updatedAt) - toMs(b.updatedAt);
        case "year_desc":
          return cmpNum(b.year, a.year);
        case "year_asc":
          return cmpNum(a.year, b.year);
        case "profit_desc":
          return cmpNum(b.expectedProfit, a.expectedProfit);
        case "profit_asc":
          return cmpNum(a.expectedProfit, b.expectedProfit);
        case "profit_rate_desc":
          return cmpNum(b.expectedProfitRate, a.expectedProfitRate);
        case "profit_rate_asc":
          return cmpNum(a.expectedProfitRate, b.expectedProfitRate);
        default:
          return 0;
      }
    });

    return sorted;
  }, [allCars, query, sort]);

  const totalPages = useMemo(() => {
    const total = filteredSortedCars.length;
    return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  }, [filteredSortedCars.length, pageSize]);

  // pageが範囲外になったら戻す
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pagedCars = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredSortedCars.slice(start, end);
  }, [filteredSortedCars, page, pageSize]);

  return (
    <div style={{ padding: 16 }}>
      <h1>Cars</h1>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onCreate} disabled={loading}>
          Create demo car
        </button>

        <button onClick={loadAllCars} disabled={loading}>
          Refresh
        </button>

        <div style={{ marginLeft: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索: stock / make / model / grade..."
            style={{ padding: "6px 10px", minWidth: 280 }}
          />

          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ padding: "6px 10px" }}>
            <option value="updated_desc">更新日（新しい順）</option>
            <option value="updated_asc">更新日（古い順）</option>
            <option value="year_desc">年式（新しい順）</option>
            <option value="year_asc">年式（古い順）</option>
            <option value="profit_desc">利益（高い順）</option>
            <option value="profit_asc">利益（低い順）</option>
            <option value="profit_rate_desc">利益率（高い順）</option>
            <option value="profit_rate_asc">利益率（低い順）</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ padding: "6px 10px" }}
          >
            <option value={10}>10件</option>
            <option value={20}>20件</option>
            <option value={50}>50件</option>
            <option value={100}>100件</option>
          </select>

          <div style={{ color: "#666", fontSize: 12 }}>
            表示: {pagedCars.length} / {filteredSortedCars.length}（取得済 {allCars.length}）
          </div>
        </div>
      </div>

      {error ? <div style={{ color: "red", marginBottom: 8 }}>{error}</div> : null}
      {loading ? <div>Loading...</div> : null}

      <div style={{ display: "flex", gap: 16 }}>
        {/* 左：一覧 */}
        <div style={{ width: 420, borderRight: "1px solid #ddd", paddingRight: 16 }}>
          {/* pagination */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ←
            </button>
            <div style={{ fontSize: 12, color: "#666" }}>
              {page} / {totalPages}
            </div>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              →
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pagedCars.map((c) => {
              const active = c.id === selectedId;
              return (
                <li
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                    background: active ? "#f5f5f5" : "transparent",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{formatText(c.stockNo)}</div>
                  <div>
                    {formatText(c.make ?? c.maker)} {formatText(c.model)} / {formatYear(c.year)}
                    {c.grade ? ` / ${c.grade}` : ""}
                  </div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    Profit:{" "}
                    {c.expectedProfit !== null && c.expectedProfit !== undefined ? fmtYen(c.expectedProfit) : "-"}
                    {"  "}
                    {c.expectedProfitRate !== null && c.expectedProfitRate !== undefined
                      ? `(${fmtPercent(c.expectedProfitRate)})`
                      : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 右：詳細 */}
        <div style={{ flex: 1 }}>
          {!selectedCar ? (
            <div style={{ color: "#666" }}>左のリストから車両を選択してください</div>
          ) : (
            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {formatText(selectedCar.make ?? selectedCar.maker)} {formatText(selectedCar.model)}
                  </div>
                  <div style={{ color: "#666" }}>{formatText(selectedCar.stockNo)}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={onCalculate} disabled={calcLoading}>
                    査定（計算）
                  </button>
                  <button onClick={onDeleteSelected} style={{ color: "#b00020" }}>
                    Delete
                  </button>
                </div>
              </div>

              {/* tabs */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setTab("info")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: tab === "info" ? "#f5f5f5" : "transparent",
                  }}
                >
                  車両情報
                </button>

                <button
                  onClick={() => setTab("valuations")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid #ddd",
                    background: tab === "valuations" ? "#f5f5f5" : "transparent",
                  }}
                >
                  査定履歴
                </button>
              </div>

              <hr style={{ margin: "16px 0" }} />

              {tab === "info" ? (
                <>
                  <div>Year: {formatYear(selectedCar.year)}</div>
                  <div>Mileage: {selectedCar.mileage ?? "-"}</div>
                  <div>Grade: {formatText(selectedCar.grade)}</div>
                  <div>Status: {formatText(selectedCar.status)}</div>
                  <div>VIN: {formatText(selectedCar.vin)}</div>
                  <div>Model Code: {formatText(selectedCar.modelCode)}</div>
                  <div>Color: {formatText(selectedCar.color)}</div>

                  <hr style={{ margin: "16px 0" }} />

                  <div>
                    Expected Sell:{" "}
                    {selectedCar.expectedSellPrice !== null && selectedCar.expectedSellPrice !== undefined
                      ? fmtYen(selectedCar.expectedSellPrice)
                      : "-"}
                  </div>
                  <div>
                    Profit:{" "}
                    {selectedCar.expectedProfit !== null && selectedCar.expectedProfit !== undefined
                      ? fmtYen(selectedCar.expectedProfit)
                      : "-"}{" "}
                    {selectedCar.expectedProfitRate !== null && selectedCar.expectedProfitRate !== undefined
                      ? `(${fmtPercent(selectedCar.expectedProfitRate)})`
                      : ""}
                  </div>
                  <div>Valuation At: {formatText(selectedCar.valuationAt)}</div>
                </>
              ) : (
                <>
                  {valuationsLoading ? <div>Loading valuations...</div> : null}

                  {!valuationsLoading && valuations.length === 0 ? (
                    <div style={{ color: "#666" }}>査定履歴がありません（再査定すると追加されます）</div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {valuations.map((v) => (
                        <li
                          key={v.id}
                          onClick={() => setSelectedValuation(v)}
                          style={{
                            padding: 12,
                            borderBottom: "1px solid #eee",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>
                            売価 {fmtYen(v.sellPrice)} / 利益 {fmtYen(v.profit)}（{fmtPercent(v.profitRate)}）
                          </div>
                          <div style={{ color: "#666", fontSize: 12 }}>valuation_at: {v.valuationAt}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {/* ポップアップ（簡易モーダル）: 査定履歴詳細 */}
              {selectedValuation ? (
                <div
                  onClick={() => setSelectedValuation(null)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "min(520px, 100%)",
                      background: "#fff",
                      borderRadius: 12,
                      padding: 16,
                      border: "1px solid #ddd",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>査定詳細</div>
                      <button onClick={() => setSelectedValuation(null)}>Close</button>
                    </div>

                    <hr style={{ margin: "12px 0" }} />

                    <div>Buy: {fmtYen(selectedValuation.buyPrice)}</div>
                    <div>Sell: {fmtYen(selectedValuation.sellPrice)}</div>
                    <div>Profit: {fmtYen(selectedValuation.profit)}</div>
                    <div>Profit Rate: {fmtPercent(selectedValuation.profitRate)}</div>

                    <hr style={{ margin: "12px 0" }} />

                    <div>valuation_at: {selectedValuation.valuationAt}</div>
                    <div>created_at: {selectedValuation.createdAt}</div>
                  </div>
                </div>
              ) : null}

              {/* ポップアップ（簡易モーダル）: 査定（計算）結果 */}
              {calcOpen ? (
                <div
                  onClick={closeCalcModal}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 16,
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "min(560px, 100%)",
                      background: "#fff",
                      borderRadius: 12,
                      padding: 16,
                      border: "1px solid #ddd",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>査定結果（計算）</div>
                      <button onClick={closeCalcModal}>Close</button>
                    </div>

                    <hr style={{ margin: "12px 0" }} />

                    {calcLoading ? <div>Calculating...</div> : null}
                    {calcError ? <div style={{ color: "red" }}>{calcError}</div> : null}

                    {!calcLoading && !calcError && calcResult ? (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ color: "#666", fontSize: 12 }}>相場レンジ</div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>
                            {fmtYen(calcResult.marketLow)} 〜 {fmtYen(calcResult.marketHigh)}
                          </div>
                          <div style={{ color: "#666" }}>中央値: {fmtYen(calcResult.marketMedian)}</div>
                        </div>

                        <hr style={{ margin: "12px 0" }} />

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>買い上限（buy_cap_price）</div>
                            <div style={{ fontWeight: 700 }}>{fmtYen(calcResult.buyCapPrice)}</div>
                          </div>

                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>推奨価格（recommended_price）</div>
                            <div style={{ fontWeight: 700 }}>{fmtYen(calcResult.recommendedPrice)}</div>
                          </div>

                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>想定利益（expected_profit）</div>
                            <div style={{ fontWeight: 700 }}>{fmtYen(calcResult.expectedProfit)}</div>
                          </div>

                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>想定利益率（expected_profit_rate）</div>
                            <div style={{ fontWeight: 700 }}>{fmtPercent(calcResult.expectedProfitRate)}</div>
                          </div>
                        </div>

                        <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                          ※ DB migration 完了後に「保存（cars更新 + car_valuations履歴追加）」を有効化します
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
