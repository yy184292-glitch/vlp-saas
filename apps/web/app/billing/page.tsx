"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type BillingKind = "estimate" | "invoice";
type BillingStatus = "draft" | "issued" | "void";

type BillingOut = {
  id: string;
  store_id: string | null;
  kind: BillingKind;
  status: BillingStatus;
  doc_no: string | null;
  customer_name: string | null;

  subtotal: number;
  tax_total: number;
  total: number;

  tax_rate: string; // APIが "0.1000" みたいな文字列で返すため
  tax_mode: string;
  tax_rounding: string;

  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

// ✅ env が無くてもローカルで動くようにデフォルトを持つ
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

function formatYen(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "¥0";
  return `¥${Math.trunc(v).toLocaleString()}`;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  // 204 などの可能性も考慮
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // @ts-expect-error: non-json response
    return null;
  }
  return (await res.json()) as T;
}

export default function BillingPage() {
  const [items, setItems] = useState<BillingOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [kind, setKind] = useState<BillingKind | "">( "");
  const [status, setStatus] = useState<BillingStatus | "">( "");

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    if (kind) qs.set("kind", kind);
    if (status) qs.set("status", status);
    return qs.toString();
  }, [limit, offset, kind, status]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<BillingOut[]>(`/api/v1/billing?${query}`);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    reload();
  }, [reload]);

  // -----------------------------
  // Actions
  // -----------------------------

  async function createDraftInvoice() {
    const customer = window.prompt("顧客名（任意）") ?? "";
    try {
      await fetchJson<BillingOut>("/api/v1/billing", {
        method: "POST",
        body: JSON.stringify({
          kind: "invoice",
          status: "draft",
          customer_name: customer.trim() || null,
          lines: [
            { name: "明細", qty: 1, unit_price: 0 },
          ],
        }),
      });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function createDraftEstimate() {
    const customer = window.prompt("顧客名（任意）") ?? "";
    try {
      await fetchJson<BillingOut>("/api/v1/billing", {
        method: "POST",
        body: JSON.stringify({
          kind: "estimate",
          status: "draft",
          customer_name: customer.trim() || null,
          lines: [
            { name: "明細", qty: 1, unit_price: 0 },
          ],
        }),
      });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function issueBilling(id: string) {
    if (!window.confirm("発行しますか？")) return;
    try {
      await fetchJson<BillingOut>(`/api/v1/billing/${id}/issue`, { method: "POST" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Issue failed");
    }
  }

  async function convertEstimateToInvoice(id: string) {
    if (!window.confirm("見積 → 請求書に変換しますか？")) return;
    try {
      await fetchJson<BillingOut>(`/api/v1/billing/${id}/convert`, { method: "POST" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Convert failed");
    }
  }

  async function voidInvoice(id: string) {
    const reason = window.prompt("取消理由（任意）") ?? "";
    if (!window.confirm("この請求書を取消(VOID)しますか？")) return;

    try {
      await fetchJson<BillingOut>(`/api/v1/billing/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Void failed");
    }
  }

  async function deleteDraft(id: string) {
    if (!window.confirm("削除しますか？（draftのみ推奨）")) return;
    try {
      await fetchJson<{ deleted: boolean }>(`/api/v1/billing/${id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function openPdf(id: string) {
    window.open(`${API_BASE}/api/v1/billing/${id}/export.pdf`, "_blank", "noopener,noreferrer");
  }

  function openCsv(id: string) {
    window.open(`${API_BASE}/api/v1/billing/${id}/export.csv`, "_blank", "noopener,noreferrer");
  }

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Billing</h1>

        <button onClick={createDraftInvoice}>+ Invoice(draft)</button>
        <button onClick={createDraftEstimate}>+ Estimate(draft)</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            kind
            <select value={kind} onChange={(e) => { setOffset(0); setKind(e.target.value as any); }}>
              <option value="">all</option>
              <option value="invoice">invoice</option>
              <option value="estimate">estimate</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            status
            <select value={status} onChange={(e) => { setOffset(0); setStatus(e.target.value as any); }}>
              <option value="">all</option>
              <option value="draft">draft</option>
              <option value="issued">issued</option>
              <option value="void">void</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            limit
            <select value={limit} onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)); }}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button onClick={reload} disabled={loading}>
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      {error && (
        <pre style={{ marginTop: 16, padding: 12, background: "#fee", border: "1px solid #f99", whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={() => setOffset((v) => Math.max(0, v - limit))}
          disabled={loading || offset === 0}
        >
          Prev
        </button>
        <div style={{ color: "#555" }}>
          offset: {offset}
        </div>
        <button
          onClick={() => setOffset((v) => v + limit)}
          disabled={loading || items.length < limit}
        >
          Next
        </button>
      </div>

      <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>No</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Kind</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Customer</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Total</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Updated</th>
            <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const canIssue = d.status === "draft";
            const canConvert = d.kind === "estimate" && d.status !== "void";
            const canVoid = d.kind === "invoice" && d.status === "issued";
            const canDelete = d.status !== "issued"; // issuedはAPI側でブロックされる想定

            return (
              <tr key={d.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  <Link href={`/billing/${d.id}`} style={{ textDecoration: "underline" }}>
                    {d.doc_no ?? d.id.slice(0, 8)}
                  </Link>
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{d.kind}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{d.status}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{d.customer_name ?? "-"}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>{formatYen(d.total)}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{formatDate(d.updated_at)}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => openPdf(d.id)}>PDF</button>
                    <button onClick={() => openCsv(d.id)}>CSV</button>

                    <button onClick={() => issueBilling(d.id)} disabled={!canIssue}>
                      Issue
                    </button>

                    <button onClick={() => convertEstimateToInvoice(d.id)} disabled={!canConvert}>
                      Convert
                    </button>

                    <button onClick={() => voidInvoice(d.id)} disabled={!canVoid}>
                      Void
                    </button>

                    <button onClick={() => deleteDraft(d.id)} disabled={!canDelete}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {items.length === 0 && !loading && (
            <tr>
              <td colSpan={7} style={{ padding: 16, color: "#666" }}>
                No data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}