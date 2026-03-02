"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ExportVehicle = {
  id: string;
  stock_no: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  export_price?: number | null;
  export_status?: string | null;
  export_image_url?: string | null;
  export_description?: string | null;
};

function apiBaseUrl() {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  return base.replace(/\/+$/, "");
}

function toMoneyUSD(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ExportVehiclePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [vehicle, setVehicle] = useState<ExportVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const endpoint = useMemo(() => {
    const base = apiBaseUrl();
    if (!base || !id) return "";
    return `${base}/api/v1/export/vehicles/${encodeURIComponent(id)}`;
  }, [id]);

  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!endpoint) throw new Error("Invalid endpoint");
        const res = await fetch(endpoint, { cache: "no-store" });
        if (res.status === 404) throw new Error("Not found");
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
        }
        const data = (await res.json()) as ExportVehicle;
        if (!aborted) setVehicle(data);
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

  if (loading) return <div className="mx-auto max-w-4xl p-6">Loading...</div>;
  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border p-4">
          <div className="font-semibold">Failed to load</div>
          <div className="mt-1 text-sm text-red-600">{error}</div>
        </div>
      </div>
    );
  }
  if (!vehicle) return <div className="mx-auto max-w-4xl p-6">No data</div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-3xl font-bold">
        {(vehicle.make ?? "-")} {(vehicle.model ?? "")}
      </h1>
      <div className="mt-2 text-gray-600">
        Stock: {vehicle.stock_no} / Year: {vehicle.year ?? "-"} / Mileage: {vehicle.mileage ?? "-"}
      </div>
      <div className="mt-3 text-xl font-bold">{toMoneyUSD(vehicle.export_price)}</div>

      <div className="mt-6">
        {vehicle.export_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.export_image_url}
            alt={`${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || "vehicle"}
            className="w-full rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-500">No image</div>
        )}
      </div>

      {vehicle.export_description ? (
        <div className="mt-6 whitespace-pre-wrap rounded-xl border p-4 text-sm">{vehicle.export_description}</div>
      ) : null}
    </div>
  );
}
