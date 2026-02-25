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
  // rate: 0.1234 -> 12.3%
  return `${(rate * 100).toFixed(1)}%`;
}

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    () => (selectedId ? cars.find((c) => c.id === selectedId) ?? null : null),
    [cars, selectedId]
  );

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const { items } = await listCars({ limit: 100, offset: 0 });
      setCars(items);
      if (selectedId && !items.some((c) => c.id === selectedId)) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 車の選択が変わったら履歴も取り直す
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

  // 選択が変わったら、とりあえず車両情報タブに戻す（好みで外してOK）
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
      setCars((prev) => [created, ...prev]);
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
      setCars((prev) => prev.filter((c) => c.id !== selectedCar.id));
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

    // API仕様: { make, model, grade, year, mileage } （Swagger準拠）
    const make = (selectedCar.make ?? selectedCar.maker ?? "").trim();
    const model = (selectedCar.model ?? "").trim();

    // grade は Car 型に無い可能性があるので安全に取得（無ければ空文字）
    const grade = String((selectedCar as unknown as { grade?: string | null }).grade ?? "").trim();

    // year/mileage は必須なので null/undefined の場合に備える
    const year = typeof selectedCar.year === "number" ? selectedCar.year : 0;
    const mileage = typeof selectedCar.mileage === "number" ? selectedCar.mileage : 0;

    setCalcOpen(true);
    setCalcLoading(true);
    setCalcError("");
    setCalcResult(null);

    try {
      const res = await calculateValuation({
        make,
        model,
        grade,
        year,
        mileage,
      });
      setCalcResult(res);
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : "Failed to calculate valuation");
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>Cars</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={onCreate} disabled={loading}>
          Create demo car
        </button>
        <button onClick={load} disabled={loading} style={{ marginLeft: 8 }}>
          Refresh
        </button>
      </div>

      {error ? <div style={{ color: "red", marginBottom: 8 }}>{error}</div> : null}
      {loading ? <div>Loading...</div> : null}

      <div style={{ display: "flex", gap: 16 }}>
        {/* 左：一覧 */}
        <div style={{ width: 420, borderRight: "1px solid #ddd", paddingRight: 16 }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {cars.map((c) => {
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
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

                    <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
                      ※ 下限/中央値/上限は次のステップでDB保存してここに表示できるようにします
                    </div>
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
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
