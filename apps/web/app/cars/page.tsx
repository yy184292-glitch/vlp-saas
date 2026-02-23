"use client";

import { useEffect, useMemo, useState } from "react";

import { createCar, deleteCar, listCars, type Car } from "@/lib/api";

type DraftCar = {
  maker: string;
  model: string;
  year: string;
};

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [draft, setDraft] = useState<DraftCar>({ maker: "", model: "", year: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearNum = useMemo(() => {
    const n = Number(draft.year);
    return Number.isFinite(n) ? n : undefined;
  }, [draft.year]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await listCars();
      setCars(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      const created = await createCar({
        maker: draft.maker.trim(),
        model: draft.model.trim(),
        year: yearNum,
      });
      setCars((prev) => [created, ...prev]);
      setDraft({ maker: "", model: "", year: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    setBusy(true);
    try {
      await deleteCar(id);
      setCars((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "48px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Cars</h1>

      {error && (
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr 160px 140px",
          alignItems: "end",
          marginBottom: 16,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>Maker</span>
          <input
            value={draft.maker}
            onChange={(e) => setDraft({ ...draft, maker: e.target.value })}
            disabled={busy}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Model</span>
          <input
            value={draft.model}
            onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            disabled={busy}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Year</span>
          <input
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
            disabled={busy}
            inputMode="numeric"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <button
          onClick={onCreate}
          disabled={busy || !draft.maker.trim() || !draft.model.trim()}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Create
        </button>
      </section>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Maker
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Model
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Year
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car.id}>
                <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                  {car.maker ?? car.make ?? ""}
                </td>
                <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                  {car.model}
                </td>
                <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                  {car.year ?? ""}
                </td>
                <td style={{ borderBottom: "1px solid #f2f2f2", padding: 8 }}>
                  <button
                    onClick={() => onDelete(car.id)}
                    disabled={busy}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "#fff",
                      cursor: busy ? "not-allowed" : "pointer",
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
