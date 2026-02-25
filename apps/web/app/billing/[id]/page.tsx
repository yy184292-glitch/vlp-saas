"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type BillingDoc = {
  id: string;
  store_id: string | null;
  kind: string;
  status: string;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL が未設定です");
  }
  return API_BASE;
}

async function fetchJson<T>(path: string): Promise<T> {
  const base = getApiBaseOrThrow();
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json();
}

function formatYen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function BillingDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchJson<BillingDoc>(
          `/api/v1/billing/${id}`
        );
        setDoc(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;

  if (error)
    return (
      <main style={{ padding: 24, color: "crimson" }}>
        Error: {error}
      </main>
    );

  if (!doc)
    return <main style={{ padding: 24 }}>Not found</main>;

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1>請求詳細</h1>

      <div style={{ marginTop: 20 }}>
        <table>
          <tbody>
            <tr>
              <td>ID</td>
              <td>{doc.id}</td>
            </tr>

            <tr>
              <td>顧客</td>
              <td>{doc.customer_name ?? "-"}</td>
            </tr>

            <tr>
              <td>種別</td>
              <td>{doc.kind}</td>
            </tr>

            <tr>
              <td>状態</td>
              <td>{doc.status}</td>
            </tr>

            <tr>
              <td>小計</td>
              <td>{formatYen(doc.subtotal)}</td>
            </tr>

            <tr>
              <td>税</td>
              <td>{formatYen(doc.tax_total)}</td>
            </tr>

            <tr>
              <td>合計</td>
              <td>
                <strong>{formatYen(doc.total)}</strong>
              </td>
            </tr>

            <tr>
              <td>作成日</td>
              <td>
                {new Date(doc.created_at).toLocaleString("ja-JP")}
              </td>
            </tr>

            <tr>
              <td>更新日</td>
              <td>
                {new Date(doc.updated_at).toLocaleString("ja-JP")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
