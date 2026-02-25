"use client";

import React, { useEffect, useMemo, useState } from "react";

type BillingStatus = "draft" | "issued";
type BillingKind = "estimate" | "invoice";

type BillingDraft = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  customerName?: string;
  total: number;
  status: BillingStatus;
  kind: BillingKind;
  lines: Array<{
    name: string;
    qty: number;
    unit?: string;
    unitPrice?: number;
    amount?: number;
  }>;
};

const STORAGE_KEY = "vlp_billing_drafts_v1";

// ==============================
// import → localStorage削除
// ==============================
async function importToDbAndClear(): Promise<number> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return 0;

  let items: unknown;
  try {
    items = JSON.parse(raw);
  } catch {
    throw new Error("localStorage JSON parse failed");
  }

  if (!Array.isArray(items)) {
    throw new Error("localStorage format invalid");
  }

  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

  const res = await fetch(`${base}/api/v1/billing/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Import failed: ${res.status} ${text}`);
  }

  const json = await res.json().catch(() => ({}));
  localStorage.removeItem(STORAGE_KEY);

  return Number(json.inserted ?? items.length);
}

// ==============================
// utils
// ==============================

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clampNumber(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function toIsoOrNow(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  const d = new Date(s);
  if (!s || Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function normalizeDraft(raw: any): BillingDraft | null {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? "").trim();
  if (!id) return null;

  const createdAt = toIsoOrNow(raw.createdAt);

  const customerName = raw.customerName;

  const status: BillingStatus =
    raw.status === "issued" ? "issued" : "draft";

  const kind: BillingKind =
    raw.kind === "estimate" ? "estimate" : "invoice";

  const total = clampNumber(raw.total, 0);

  const linesRaw = raw.lines ?? [];
  const lines = Array.isArray(linesRaw)
    ? linesRaw.map((x: any) => ({
        name: String(x.name ?? "明細"),
        qty: clampNumber(x.qty, 0),
        unit: x.unit,
        unitPrice: x.unitPrice,
        amount:
          x.amount ??
          (x.unitPrice !== undefined
            ? clampNumber(x.unitPrice) * clampNumber(x.qty)
            : undefined),
      }))
    : [];

  return {
    id,
    createdAt,
    customerName,
    total,
    status,
    kind,
    lines,
  };
}

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
  }).format(n);
}

// ==============================
// component
// ==============================

export default function BillingPage() {
  const [drafts, setDrafts] = useState<BillingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    const parsed =
      safeJsonParse<any[]>(localStorage.getItem(STORAGE_KEY)) ?? [];

    const normalized = parsed
      .map(normalizeDraft)
      .filter(Boolean) as BillingDraft[];

    normalized.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    setDrafts(normalized);
    setLoading(false);
  }, []);

  async function handleImport() {
    const ok = confirm(
      "DBへ移行して localStorage を削除します。よろしいですか？"
    );
    if (!ok) return;

    try {
      setImporting(true);
      setImportMsg(null);

      const count = await importToDbAndClear();

      setDrafts([]);
      setImportMsg(`DBへ移行しました (${count}件)`);

    } catch (e) {
      setImportMsg(
        e instanceof Error ? e.message : "Import failed"
      );
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>

      <h1 style={{ fontSize: 22 }}>見積・請求（localStorage）</h1>

      <div style={{ marginTop: 12 }}>

        <button
          onClick={handleImport}
          disabled={importing}
          style={{ padding: "10px 14px", fontSize: 14 }}
        >
          {importing ? "移行中..." : "DBへ移行"}
        </button>

        <a
          href="/reports"
          style={{ marginLeft: 12, fontSize: 14 }}
        >
          DB一覧を見る →
        </a>

      </div>

      {importMsg && (
        <div style={{ marginTop: 12 }}>
          {importMsg}
        </div>
      )}

      <div style={{ marginTop: 20 }}>

        {drafts.length === 0 ? (
          <div>localStorageにデータはありません</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>顧客</th>
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.customerName ?? "-"}</td>
                  <td>{formatYen(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>

      <p style={{ marginTop: 20, fontSize: 12 }}>
        localStorage → DB 移行対応済
      </p>

    </main>
  );
}
