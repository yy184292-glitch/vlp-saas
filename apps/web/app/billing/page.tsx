"use client";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type BillingStatus = "draft" | "issued" | "void";
type BillingKind = "estimate" | "invoice";

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

type BillingLineIn = {
  name: string;
  qty: number;
  unit?: string;
  unit_price?: number;
  cost_price?: number;
};

type BillingCreateIn = {
  kind: BillingKind;
  status: BillingStatus;
  store_id?: string | null;
  customer_name?: string;
  lines: BillingLineIn[];
  meta?: Record<string, unknown>;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getApiBaseOrThrow(): string {
  if (!API_BASE) {
    // mis-config を早期に検知（SSR/CSR どちらでも原因が分かる）
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

export default function BillingPage() {
  // DB list
  const [items, setItems] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [customerName, setCustomerName] = useState("");
  const [kind, setKind] = useState<BillingKind>("invoice");
  const [lines, setLines] = useState<BillingLineIn[]>([
    { name: "作業費", qty: 1, unit_price: 10000 },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    return lines.reduce((sum, ln) => {
      const qty = safeNumber(ln.qty, 0);
      const unit =
        ln.unit_price == null ? 0 : Math.trunc(safeNumber(ln.unit_price, 0));
      return sum + Math.trunc(qty * unit);
    }, 0);
  }, [lines]);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchJson<BillingDoc[]>(
        `/api/v1/billing?limit=100&offset=0`
      );
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function updateLine(idx: number, patch: Partial<BillingLineIn>) {
    setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function addLine() {
    setLines((prev) => [...prev, { name: "明細", qty: 1, unit_price: 0 }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function createDraft() {
    setSaving(true);
    setSaveMsg(null);

    try {
      const body: BillingCreateIn = {
        kind,
        status: "draft",
        customer_name: customerName.trim() || undefined,
        lines: lines
          .map((ln) => ({
            name: (ln.name || "").trim(),
            qty: safeNumber(ln.qty, 0),
            unit: ln.unit,
            unit_price:
              ln.unit_price == null
                ? undefined
                : Math.trunc(safeNumber(ln.unit_price, 0)),
            cost_price:
              ln.cost_price == null
                ? undefined
                : Math.trunc(safeNumber(ln.cost_price, 0)),
          }))
          .filter((ln) => ln.name.length > 0),
        meta: { _ui: "billing-page" },
      };

      await fetchJson(`/api/v1/billing`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setSaveMsg("DBへ保存しました");
      setCustomerName("");
      setLines([{ name: "作業費", qty: 1, unit_price: 10000 }]);
      await reload();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>見積・請求（DB）</h1>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>下書きを作成（DB）</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <label>
            顧客名：
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ marginLeft: 8 }}
              placeholder="例）山田 太郎"
            />
          </label>

          <label>
            種別：
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as BillingKind)}
              style={{ marginLeft: 8 }}
            >
              <option value="invoice">invoice</option>
              <option value="estimate">estimate</option>
            </select>
          </label>

          <div style={{ marginLeft: "auto" }}>
            合計（概算）：<strong>{formatYen(previewTotal)}</strong>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={addLine}>明細を追加</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">名称</th>
                <th align="right">数量</th>
                <th align="right">単価</th>
                <th align="right">小計</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((ln, idx) => {
                const qty = safeNumber(ln.qty, 0);
                const unit =
                  ln.unit_price == null ? 0 : Math.trunc(safeNumber(ln.unit_price, 0));
                const amount = Math.trunc(qty * unit);

                return (
                  <tr key={idx}>
                    <td>
                      <input
                        value={ln.name}
                        onChange={(e) => updateLine(idx, { name: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </td>
                    <td align="right">
                      <input
                        value={ln.qty}
                        onChange={(e) => updateLine(idx, { qty: safeNumber(e.target.value, 0) })}
                        style={{ width: 80, textAlign: "right" }}
                      />
                    </td>
                    <td align="right">
                      <input
                        value={ln.unit_price ?? ""}
                        onChange={(e) =>
                          updateLine(idx, {
                            unit_price: e.target.value === "" ? undefined : safeNumber(e.target.value, 0),
                          })
                        }
                        style={{ width: 120, textAlign: "right" }}
                      />
                    </td>
                    <td align="right">{formatYen(amount)}</td>
                    <td align="right">
                      <button onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={createDraft} disabled={saving}>
            {saving ? "保存中..." : "下書きをDBへ保存"}
          </button>
          {saveMsg && <span>{saveMsg}</span>}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16 }}>最近の請求（DB）</h2>

        {loading && <p>Loading...</p>}
        {err && <p style={{ color: "crimson" }}>読み込みエラー: {err}</p>}
        {!loading && !err && items.length === 0 && <p>データがありません</p>}

        {!loading && !err && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">ID</th>
                <th align="left">作成日</th>
                <th align="left">顧客</th>
                <th align="left">種別</th>
                <th align="left">状態</th>
                <th align="right">合計</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    <Link href={`/billing/${d.id}`}>{d.id}</Link>
                  </td>
                  </td>
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
      </div>
    </main>
  );
}
