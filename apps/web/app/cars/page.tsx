// apps/web/app/cars/page.tsx
"use client";

import { useEffect, useState } from "react";
import { listCars, createCar, deleteCar, type Car, type CarInput } from "@/lib/api";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/api";

export const dynamic = "force-dynamic";

function formatText(v: string | null | undefined): string {
  return v ?? "";
}
function formatYear(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

export default function CarsPage() {
  const router = useRouter();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // AuthGuard（最低限）
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const { items } = await listCars({ limit: 100, offset: 0 });
        setCars(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load cars");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onCreate = async () => {
  setError("");

  const input: CarInput = {
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

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Cars</h1>

      {error ? <p style={{ whiteSpace: "pre-wrap" }}>{error}</p> : null}

      <button onClick={onCreate}>Create</button>

      <ul>
        {cars.map((c) => (
          <li key={c.id}>
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
                : "-"}
              {" "}
              {c.expectedProfitRate !== null && c.expectedProfitRate !== undefined
                ? `(${(c.expectedProfitRate * 100).toFixed(1)}%)`
                : ""}
            </div>

            <button onClick={() => onDelete(c.id)}>Delete</button>
          </li>
        ))}
      </ul>
