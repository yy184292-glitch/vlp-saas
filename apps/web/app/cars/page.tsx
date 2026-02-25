"use client";

import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const { items } = await listCars({ limit: 100, offset: 0 });
      setCars(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cars");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const onDelete = async (id: string) => {
    setError("");
    try {
      await deleteCar(id);
      setCars((prev) => prev.filter((c) => c.id !== id));
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

      {error ? <div style={{ color: "red" }}>{error}</div> : null}
      {loading ? <div>Loading...</div> : null}

      <ul>
        {cars.map((c) => (
          <li key={c.id} style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
            <div>Stock No: {formatText(c.stockNo)}</div>
            <div>
              Car: {formatText(c.make ?? c.maker)} {formatText(c.model)}
            </div>
            <div>Year: {formatYear(c.year)}</div>
            <div>Mileage: {c.mileage ?? "-"}</div>
            <div>Status: {formatText(c.status)}</div>
            <div>VIN: {formatText(c.vin)}</div>

            <div>
              Expected Sell:{" "}
              {c.expectedSellPrice !== null && c.expectedSellPrice !== undefined
                ? `¥${c.expectedSellPrice.toLocaleString()}`
                : "-"}
            </div>

            <div>
              Profit:{" "}
              {c.expectedProfit !== null && c.expectedProfit !== undefined
                ? `¥${c.expectedProfit.toLocaleString()}`
                : "-"}{" "}
              {c.expectedProfitRate !== null && c.expectedProfitRate !== undefined
                ? `(${(c.expectedProfitRate * 100).toFixed(1)}%)`
                : ""}
            </div>

            <button onClick={() => onDelete(c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
