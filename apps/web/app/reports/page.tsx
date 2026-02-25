"use client";

import { useEffect, useMemo, useState } from "react";

type BillingDoc = {
  id: string;
  created_at: string;
  customer_name: string | null;
  total: number;
  status: "draft" | "issued" | "void";
  kind: "estimate" | "invoice";
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL が未設定です");
  }
  return API_BASE;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseOrThrow();
  const url = `${base}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

function formatYen(n: number): string {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `¥${n.toLocaleString()}`;
  }
}

export default function ReportsPage() {
  const [items, setItems] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"" | BillingDoc["status"]>("");
  const [kind, setKind] = useState<"" | BillingDoc["kind"]>("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (kind) p.set("kind", kind);
    p.set("limit", "100");
    p.set("offset", "0");
    return p.toString();
  }, [status, kind]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchJson<BillingDoc[]>(
          `/api/v1/billing?${query}`,
          { method: "GET" }
        );

        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <main style={{ padding: 24 }}>
      <h1>請求書（DB）</h1>

      <div style={{ display: "flex", gap: 12, margin: "12px 0 18px" }}>
        <label>
          状態：
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{ marginLeft: 8 }}
          >
            <option value="">すべて</option>
            <option value="draft">draft</option>
            <option value="issued">issued</option>
            <option value="void">void</option>
          </select>
        </label>

        <label>
          種別：
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as any)}
            style={{ marginLeft: 8 }}
          >
            <option value="">すべて</option>
            <option value="estimate">estimate</option>
            <option value="invoice">invoice</option>
          </select>
        </label>

        <button
          onClick={() => {
            setStatus("");
            setKind("");
          }}
        >
          フィルタ解除
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>読み込みエラー: {error}</p>}

      {!loading && !error && items.length === 0 && <p>データがありません</p>}

      {!loading && !error && items.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>作成日</th>
              <th>顧客</th>
              <th>種別</th>
              <th>状態</th>
              <th align="right">合計</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{new Date(d.created_at).toLocaleString("ja-JP")}</td>
                <td>{d.customer_name ?? "-"}</td>
                <td>{d.kind}</td>
                <td>{d.status}</td>
                <td align="right">{formatYen(d.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
