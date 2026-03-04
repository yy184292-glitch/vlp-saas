"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getCar, apiFetch } from "@/lib/api";

type StoreSettings = {
  store_id: string;
  print_fields?: any | null;
};

function joinAddress(a1?: string | null, a2?: string | null): string {
  return [a1 ?? "", a2 ?? ""].filter(Boolean).join(" ");
}

export default function Page({ params }: { params: { id: string } }) {
  const carId = params.id;
  const printedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [car, setCar] = useState<any>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const pf = settings?.print_fields?.jouto ?? {};
  const showCarInfo = pf.car_info !== false;
  const showOwners = pf.owners_block !== false;
  const showDate = pf.transfer_date !== false;

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await getCar(carId);
        const s = await apiFetch<StoreSettings>("/api/v1/settings/store", { method: "GET" });
        setCar(c);
        setSettings(s);
      } catch (e) {
        const ae = e as ApiError;
        setError(ae.message ?? "読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [carId]);

  useEffect(() => {
    if (loading || error) return;
    if (printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [loading, error]);

  if (loading) return <main className="p-4">読み込み中...</main>;
  if (error || !car) return <main className="p-4 text-red-600">{error ?? "読み込みに失敗しました"}</main>;

  const today = new Date();
  const yy = today.getFullYear();
  const mm = String(today.getMonth() + 1);
  const dd = String(today.getDate());

  return (
    <main style={{ margin: 0, padding: 0, background: "white" }}>
      <style>{`@page { size: A4; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div
        style={{
          position: "relative",
          width: "210mm",
          height: "297mm",
          overflow: "hidden",
          backgroundImage: "url(/forms/jouto.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "210mm 297mm",
        }}
      >
        {showCarInfo ? (
          <>
            <div style={{ position: "absolute", left: "25mm", top: "54mm", fontSize: "11pt" }}>
              {car.maker ?? car.make ?? ""}
            </div>
            <div style={{ position: "absolute", left: "63mm", top: "54mm", fontSize: "11pt" }}>
              {car.model_code ?? ""}
            </div>
            <div style={{ position: "absolute", left: "98mm", top: "54mm", fontSize: "11pt" }}>
              {car.vin ?? ""}
            </div>
            <div style={{ position: "absolute", left: "150mm", top: "54mm", fontSize: "11pt" }}>
              ""
            </div>
          </>
        ) : null}

        {showOwners ? (
          <>
            <div style={{ position: "absolute", left: "72mm", top: "86mm", fontSize: "10pt", width: "120mm" }}>
              {car.owner_name ?? ""}
              <br />
              {car.owner_postal_code ? `〒${car.owner_postal_code} ` : ""}
              {joinAddress(car.owner_address1, car.owner_address2)}
            </div>

            <div style={{ position: "absolute", left: "72mm", top: "120mm", fontSize: "10pt", width: "120mm" }}>
              {car.new_owner_name ?? ""}
              <br />
              {car.new_owner_postal_code ? `〒${car.new_owner_postal_code} ` : ""}
              {joinAddress(car.new_owner_address1, car.new_owner_address2)}
            </div>
          </>
        ) : null}

        {showDate ? (
          <div style={{ position: "absolute", left: "22mm", top: "116mm", fontSize: "10pt" }}>
            {yy}年 {mm}月 {dd}日
          </div>
        ) : null}
      </div>
    </main>
  );
}
