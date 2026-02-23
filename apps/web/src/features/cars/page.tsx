"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, createCar, deleteCar, listCars } from "@/features/cars/carsApi";

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number>(2024);

  const canSubmit = useMemo(() => {
    return make.trim().length > 0 && model.trim().length > 0 && Number.isFinite(year);
  }, [make, model, year]);

  async function reload() {
    setErr(null);
    setLoading(true);
    try {
      const data = await listCars();
      setCars(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate() {
    if (!canSubmit) return;
    setErr(null);
    setLoading(true);
    try {
      await createCar({ make, model, year });
      setMake("");
      setModel("");
      setYear(2024);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    setErr(null);
    setLoading(true);
    try {
      await deleteCar(id);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Cars</h1>

      {err && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
          <b>Error</b>
          <div style={{ whiteSpace: "pre-wrap" }}>{err}</div>
        </div>
      )}

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Create</h2>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 120px 120px", marginTop: 8 }}>
          <input
            placeholder="make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            disabled={loading}
          />
          <input
            placeholder="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
          />
          <input
            placeholder="year"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={loading}
          />
          <button onClick={onCreate} disabled={loading || !canSubmit}>
            Create
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <button onClick={reload} disabled={loading}>
            Reload
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>List</h2>

        {loading && <div style={{ marginTop: 8 }}>Loading...</div>}

        <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Make</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Model</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Year</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{c.make}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{c.model}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{c.year}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  <button onClick={() => onDelete(c.id)} disabled={loading}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {cars.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ padding: 8 }}>
                  No cars.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
