"use client";

import { useEffect, useMemo, useState } from "react";
import type { Car } from "@/lib/api";
import { createCar, deleteCar, listCars } from "@/lib/api";

function formatText(v: string | null | undefined) {
  return v && v.trim() ? v : "-";
}
function formatYear(v: number | null | undefined) {
  return v !== null && v !== undefined ? String(v) : "-";
}

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      // 選択が消えてたら解除
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
                    {c.expectedProfit !== null && c.expectedProfit !== undefined
                      ? `¥${c.expectedProfit.toLocaleString()}`
                      : "-"}
                    {"  "}
                    {c.expectedProfitRate !== null && c.expectedProfitRate !== undefined
                      ? `(${(c.expectedProfitRate * 100).toFixed(1)}%)`
                      : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 右：詳細（選択中のみ） */}
        <div style={{ flex: 1 }}>
          {!selectedCar ? (
            <div style={{ color: "#666" }}>左のリストから車両を選択してください</div>
          ) : (
            <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {formatText(selectedCar.make ?? selectedCar.maker)} {formatText(selectedCar.model)}
                  </div>
                  <div style={{ color: "#666" }}>{formatText(selectedCar.stockNo)}</div>
                </div>

                <button onClick={onDeleteSelected} style={{ color: "#b00020" }}>
                  Delete
                </button>
              </div>

              <hr style={{ margin: "16px 0" }} />

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
                  ? `¥${selectedCar.expectedSellPrice.toLocaleString()}`
                  : "-"}
              </div>
              <div>
                Profit:{" "}
                {selectedCar.expectedProfit !== null && selectedCar.expectedProfit !== undefined
                  ? `¥${selectedCar.expectedProfit.toLocaleString()}`
                  : "-"}{" "}
                {selectedCar.expectedProfitRate !== null && selectedCar.expectedProfitRate !== undefined
                  ? `(${(selectedCar.expectedProfitRate * 100).toFixed(1)}%)`
                  : ""}
              </div>
              <div>Valuation At: {formatText(selectedCar.valuationAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
