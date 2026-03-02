"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ExportVehicle = {
  id: string;
  stock_no: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  export_price?: number | null;
  export_image_url?: string | null;
};

function apiBaseUrl() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  return base.replace(/\/+$/, "");
}

function toMoneyUSD(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ExportPage() {
  const [items, setItems] = useState<ExportVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const endpoint = useMemo(() => {
    const base = apiBaseUrl();
    return base ? `${base}/api/v1/export/vehicles` : "";
  }, []);

  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!endpoint) throw new Error("API base URL is not configured");
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
        }
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data)) throw new Error("Invalid response");
        if (!aborted) setItems(data as ExportVehicle[]);
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      aborted = true;
    };
  }, [endpoint]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Vehicles for Export</h1>
      </div>

      {loading ? <div className="mt-6">Loading...</div> : null}

      {!loading && error ? (
        <div className="mt-6 rounded-xl border p-4">
          <div className="font-semibold">Failed to load</div>
          <div className="mt-1 text-sm text-red-600">{error}</div>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((v) => (
            <Link key={v.id} href={`/export/vehicle/${v.id}`} className="rounded-2xl border p-4 hover:shadow">
              {v.export_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.export_image_url}
                  alt={`${v.make ?? ""} ${v.model ?? ""}`.trim() || "vehicle"}
                  className="mb-3 h-48 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="mb-3 flex h-48 w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
                  No image
                </div>
              )}

              <div className="text-lg font-semibold">
                {(v.make ?? "-")} {(v.model ?? "")}
              </div>
              <div className="mt-1 text-sm text-gray-600">Year: {v.year ?? "-"}</div>
              <div className="mt-2 text-base font-bold">{toMoneyUSD(v.export_price)}</div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
