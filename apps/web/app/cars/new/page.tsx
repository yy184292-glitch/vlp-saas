"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCar } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function NewCarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stockNo, setStockNo] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const car = await createCar({
        stock_no: stockNo || null,
        make: make || null,
        model: model || null,
      });
      router.push(`/cars/${car.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">車両 新規登録</h1>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</div>}

      <div className="space-y-3 rounded-xl border bg-white p-4">
        <label className="block">
          <div className="text-xs text-neutral-600">在庫No</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={stockNo} onChange={(e) => setStockNo(e.target.value)} />
        </label>

        <label className="block">
          <div className="text-xs text-neutral-600">メーカー</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={make} onChange={(e) => setMake(e.target.value)} />
        </label>

        <label className="block">
          <div className="text-xs text-neutral-600">車種</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={model} onChange={(e) => setModel(e.target.value)} />
        </label>

        <div className="flex justify-end">
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "作成中…" : "作成"}
          </Button>
        </div>
      </div>
    </div>
  );
}