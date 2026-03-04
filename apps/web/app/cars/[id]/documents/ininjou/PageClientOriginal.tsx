"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getCar, apiFetch } from "@/lib/api";

type StoreSettings = {
  store_id: string;
  default_staff_id?: string | null;
  print_fields?: any | null;
};

type Staff = {
  id: string;
  name: string;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
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
  const [staff, setStaff] = useState<Staff[]>([]);

  const pf = settings?.print_fields?.ininjou ?? {};
  const showRecipient = pf.recipient_block !== false;
  const showPurpose = pf.purpose_transfer !== false;
  const showCarNo = pf.car_number !== false;
  const showDelegator = pf.delegator_block !== false;

  const recipient = useMemo(() => {
    const defId = settings?.default_staff_id ?? null;
    if (!defId) return null;
    return staff.find((s) => s.id === defId) ?? null;
  }, [settings, staff]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await getCar(carId);
        const s = await apiFetch<StoreSettings>("/api/v1/settings/store", { method: "GET" });
        const st = await apiFetch<Staff[]>("/api/v1/masters/staff", { method: "GET" });
        setCar(c);
        setSettings(s);
        setStaff(st);
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

  // NOTE: 位置は次の工程でサンプルを元に詰める。いまは「原本に近い場所に出る」優先。
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
          backgroundImage: "url(/forms/ininjou.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "210mm 297mm",
        }}
      >
        {showRecipient && recipient ? (
          <>
            <div style={{ position: "absolute", left: "38mm", top: "45mm", fontSize: "11pt" }}>
              {recipient.postal_code ? `〒${recipient.postal_code}` : ""}
            </div>
            <div style={{ position: "absolute", left: "38mm", top: "51mm", fontSize: "11pt", maxWidth: "150mm" }}>
              {joinAddress(recipient.address1, recipient.address2)}
            </div>
            <div style={{ position: "absolute", left: "38mm", top: "58mm", fontSize: "12pt", fontWeight: 600 }}>
              {recipient.name}
            </div>
          </>
        ) : null}

        {showPurpose ? (
          <div style={{ position: "absolute", left: "86mm", top: "77mm", fontSize: "11pt", fontWeight: 600 }}>
            移転登録
          </div>
        ) : null}

        {showCarNo ? (
          <div style={{ position: "absolute", left: "74mm", top: "96mm", fontSize: "12pt" }}>
            {car.car_number ?? ""}
          </div>
        ) : null}

        {showDelegator ? (
          <>
            <div style={{ position: "absolute", left: "22mm", top: "226mm", fontSize: "11pt", maxWidth: "80mm" }}>
              {car.owner_name ?? ""}
            </div>
            <div style={{ position: "absolute", left: "22mm", top: "234mm", fontSize: "10pt", maxWidth: "90mm" }}>
              {car.owner_postal_code ? `〒${car.owner_postal_code} ` : ""}
              {joinAddress(car.owner_address1, car.owner_address2)}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
