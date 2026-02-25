"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type BillingDoc = {
  id: string;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  status: string;
  kind: string;
  created_at: string;
};

type BillingLine = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) throw new Error("API_BASE not set");
  return API_BASE;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Page() {
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    (async () => {
      const [docRes, lineRes] = await Promise.all([
        fetchJson<BillingDoc>(`/api/v1/billing/${id}`),
        fetchJson<BillingLine[]>(`/api/v1/billing/${id}/lines`),
      ]);

      setDoc(docRes);
      setLines(lineRes);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!doc) return <main style={{ padding: 24 }}>Not found</main>;

  return (
    <main style={{ padding: 24 }}>
      <h1>請求詳細</h1>

      <div>
        顧客: {doc.customer_name}
        <br />
        種別: {doc.kind}
        <br />
        状態: {doc.status}
      </div>

      <h2>明細</h2>

      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>数量</th>
            <th>単価</th>
            <th>金額</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              <td>{l.qty}</td>
              <td>{yen(l.unit_price)}</td>
              <td>{yen(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>合計: {yen(doc.total)}</h2>
    </main>
  );
}
