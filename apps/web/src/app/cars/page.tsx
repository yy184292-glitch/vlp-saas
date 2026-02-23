"use client";

import { useEffect, useState } from "react";
import { listCars, createCar, deleteCar, type Car } from "@/lib/api";

type DraftCar = {
  maker: string;
  model: string;
  year: string;
};

export default function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [draft, setDraft] = useState<DraftCar>({ maker: "", model: "", year: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCars() {
    try {
      setLoading(true);
      const data = await listCars();
      setCars(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load cars");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCars();
  }, []);

  async function handleCreate() {
    try {
      setError(null);

      const payload = {
        stockNo: "TEMP",
        maker: draft.maker.trim(),
        model: draft.model.trim(),
        year: Number(draft.year) || 2000,
        price: 0,
        status: "available" as const,
      };

      const created = await createCar(payload);

      setCars((prev) => [created, ...prev]);

      setDraft({ maker: "", model: "", year: "" });
    } catch (e: any) {
      setError(e?.message ?? "Create failed");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCar(id);
      setCars((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      setError(e?.message ?? "Delete failed");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Cars</h1>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Maker"
          value={draft.maker}
          onChange={(e) => setDraft({ ...draft, maker: e.target.value })}
        />
        <input
          placeholder="Model"
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
        />
        <input
          placeholder="Year"
          value={draft.year}
          onChange={(e) => setDraft({ ...draft, year: e.target.value })}
        />
        <button onClick={handleCreate}>Create</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>Maker</th>
              <th>Model</th>
              <th>Year</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car.id}>
                <td>{String(car.maker ?? "")}</td>
                <td>{String(car.model ?? "")}</td>
                <td>{String(car.year ?? "")}</td>
                <td>
                  <button onClick={() => handleDelete(car.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
