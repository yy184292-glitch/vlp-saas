"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type BillingDoc = {
  id: string;
  kind: string;
  status: string;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  issued_at: string | null;
  created_at: string;
};

type BillingLine = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
  sort_order?: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL が未設定です");
  return API_BASE;
}

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
    headers: { ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(n);
}

export default function PrintPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id || "");

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [d, ls] = await Promise.all([
          fetchJson<BillingDoc>(`/api/v1/billing/${id}`),
          fetchJson<BillingLine[]>(`/api/v1/billing/${id}/lines`),
        ]);
        setDoc(d);
        setLines(ls.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, [id]);

  if (err) return <main style={{ padding: 24, color: "crimson" }}>{err}</main>;
  if (!doc) return <main style={{ padding: 24 }}>Loading...</main>;

  return (
    <main style={{ padding: 24 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .sheet {
          max-width: 860px;
          margin: 0 auto;
          border: 1px solid #ddd;
          padding: 24px;
          border-radius: 10px;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border-bottom: 1px solid #eee; }
      `}</style>

      <div className="no-print" style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={() => router.push(`/billing/${doc.id}`)}>← 戻る</button>
        <button onClick={() => window.print()}>印刷</button>
      </div>

      <div className="sheet">
        <h1 style={{ marginTop: 0 }}>{doc.kind === "invoice" ? "請求書" : "見積書"}</h1>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div>顧客: {doc.customer_name ?? "-"}</div>
            <div>状態: {doc.status}</div>
            <div>発行日: {doc.issued_at ? new Date(doc.issued_at).toLocaleDateString("ja-JP") : "-"}</div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            <div>ID</div>
            <div>{doc.id}</div>
          </div>
        </div>

        <h2 style={{ marginTop: 18 }}>明細</h2>
        <table>
          <thead>
            <tr>
              <th align="left">名称</th>
              <th align="right">数量</th>
              <th align="right">単価</th>
              <th align="right">金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td align="right">{l.qty}</td>
                <td align="right">{yen(l.unit_price)}</td>
                <td align="right">{yen(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>小計</span>
              <strong>{yen(doc.subtotal)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>税</span>
              <strong>{yen(doc.tax_total)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
              <span>合計</span>
              <strong>{yen(doc.total)}</strong>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
