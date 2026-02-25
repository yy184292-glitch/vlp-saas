"use client";

import React, { useEffect, useMemo, useState } from "react";

type BillingStatus = "draft" | "issued";
type BillingKind = "estimate" | "invoice";

/**
 * Billing Draft（MVP拡張）
 * - 既存の保存形が違っていても読み込めるように normalize で吸収します。
 */
type BillingDraft = {
  id: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
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

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("JSON parse failed:", e);
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

  const id = String(raw.id ?? raw.draftId ?? raw.billingId ?? "").trim();
  if (!id) return null;

  const createdAt = toIsoOrNow(raw.createdAt ?? raw.created_at ?? raw.created);
  const updatedAt =
    typeof raw.updatedAt === "string"
      ? raw.updatedAt
      : typeof raw.updated_at === "string"
        ? raw.updated_at
        : undefined;

  const customerName =
    raw.customerName ?? raw.customer_name ?? raw.customer ?? raw.customer?.name;

  const statusRaw = String(raw.status ?? "draft");
  const status: BillingStatus = statusRaw === "issued" ? "issued" : "draft";

  const kindRaw = String(raw.kind ?? raw.type ?? "invoice");
  const kind: BillingKind = kindRaw === "estimate" ? "estimate" : "invoice";

  // totals を吸収
  const totalCandidate =
    Number.isFinite(Number(raw.total)) ? Number(raw.total) : NaN;
  const altCandidate =
    Number.isFinite(Number(raw.grandTotal))
      ? Number(raw.grandTotal)
      : Number.isFinite(Number(raw.amount))
        ? Number(raw.amount)
        : Number.isFinite(Number(raw.totalAmount))
          ? Number(raw.totalAmount)
          : NaN;

  const total = Number.isFinite(totalCandidate)
    ? totalCandidate
    : Number.isFinite(altCandidate)
      ? altCandidate
      : 0;

  // lines を吸収（work-order snapshot 由来でもOK）
  const linesRaw = raw.lines ?? raw.items ?? raw.details ?? raw.lineItems ?? [];
  const linesArr: any[] = Array.isArray(linesRaw) ? linesRaw : [];
  const lines = linesArr.map((x) => {
    const name = String(x.name ?? x.title ?? x.workName ?? x.itemName ?? "明細");
    const qty = clampNumber(x.qty ?? x.quantity ?? x.count ?? 0, 0);
    const unit = x.unit ? String(x.unit) : undefined;
    const unitPrice = Number.isFinite(Number(x.unitPrice))
      ? Number(x.unitPrice)
      : Number.isFinite(Number(x.price))
        ? Number(x.price)
        : undefined;
    const amount = Number.isFinite(Number(x.amount))
      ? Number(x.amount)
      : unitPrice !== undefined
        ? unitPrice * qty
        : undefined;

    return { name, qty, unit, unitPrice, amount };
  });

  return {
    id,
    createdAt,
    updatedAt,
    customerName: customerName ? String(customerName) : undefined,
    total,
    status,
    kind,
    lines,
  };
}

function formatYen(n: number): string {
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
    }).format(n);
  } catch {
    return `¥${Math.round(n).toLocaleString()}`;
  }
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

type StatusFilter = "all" | BillingStatus;
type KindFilter = "all" | BillingKind;

export default function BillingPage() {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );

  const [drafts, setDrafts] = useState<BillingDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [fromYmdValue, setFromYmdValue] = useState(() => toYmd(initialFrom));
  const [toYmdValue, setToYmdValue] = useState(() => toYmd(today));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? null,
    [drafts, selectedId]
  );

  function persist(next: BillingDraft[]) {
    // localStorage へは「できるだけ元形に近く」ではなく、MVPとして正規化後を保存
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    try {
      setLoadError(null);
      const parsed = safeJsonParse<any[]>(localStorage.getItem(STORAGE_KEY)) ?? [];
      const normalized = parsed
        .map((x) => normalizeDraft(x))
        .filter((x): x is BillingDraft => x !== null);

      normalized.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setDrafts(normalized);
      // デフォで先頭を選択（あれば）
      setSelectedId(normalized[0]?.id ?? null);
    } catch (e) {
      console.error(e);
      setDrafts([]);
      setSelectedId(null);
      setLoadError("請求データの読み込みに失敗しました（localStorage）。");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const from = fromYmd(fromYmdValue) ?? initialFrom;
    const to = fromYmd(toYmdValue) ?? today;
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

    return drafts.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      if (Number.isNaN(t)) return false;
      if (t < from.getTime()) return false;
      if (t > toEnd.getTime()) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;
      return true;
    });
  }, [drafts, fromYmdValue, toYmdValue, statusFilter, kindFilter, initialFrom, today]);

  const summary = useMemo(() => {
    const count = filtered.length;
    const total = filtered.reduce((acc, d) => acc + d.total, 0);
    return { count, total, avg: count ? total / count : 0 };
  }, [filtered]);

  function markIssued(id: string) {
    const ok = window.confirm("この下書きを「発行済み」にしますか？");
    if (!ok) return;

    const next = drafts.map((d) =>
      d.id === id
        ? {
            ...d,
            status: "issued" as const,
            updatedAt: new Date().toISOString(),
          }
        : d
    );
    setDrafts(next);
    persist(next);
  }

  function removeDraft(id: string) {
    const ok = window.confirm("この下書きを削除しますか？（元に戻せません）");
    if (!ok) return;

    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    persist(next);

    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null);
    }
  }

  function setQuickRange(mode: "thisMonth" | "last7" | "last30") {
    const now = new Date();
    if (mode === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromYmdValue(toYmd(start));
      setToYmdValue(toYmd(now));
      return;
    }
    if (mode === "last7") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setFromYmdValue(toYmd(start));
      setToYmdValue(toYmd(now));
      return;
    }
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    setFromYmdValue(toYmd(start));
    setToYmdValue(toYmd(now));
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22 }}>見積・請求</h1>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>見積・請求（MVP）</h1>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>開始</label>
            <input
              type="date"
              value={fromYmdValue}
              onChange={(e) => setFromYmdValue(e.target.value)}
              style={{ padding: 8 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>終了</label>
            <input
              type="date"
              value={toYmdValue}
              onChange={(e) => setToYmdValue(e.target.value)}
              style={{ padding: 8 }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>状態</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ padding: 8 }}
            >
              <option value="all">すべて</option>
              <option value="draft">下書き</option>
              <option value="issued">発行済み</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>種別</label>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
              style={{ padding: 8 }}
            >
              <option value="all">すべて</option>
              <option value="invoice">請求</option>
              <option value="estimate">見積</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setQuickRange("thisMonth")} style={{ padding: "8px 10px" }}>
              今月
            </button>
            <button type="button" onClick={() => setQuickRange("last7")} style={{ padding: "8px 10px" }}>
              直近7日
            </button>
            <button type="button" onClick={() => setQuickRange("last30")} style={{ padding: "8px 10px" }}>
              直近30日
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "#555" }}>
          データ: localStorage（{STORAGE_KEY}） / 件数: {summary.count} / 合計: {formatYen(summary.total)} /
          平均: {formatYen(summary.avg)}
        </div>

        {loadError && (
          <div style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>{loadError}</div>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* 一覧 */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 700 }}>
            一覧（{filtered.length}）
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 12, color: "#666" }}>対象データがありません</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thLeft}>作成日</th>
                    <th style={thLeft}>顧客</th>
                    <th style={thLeft}>種別</th>
                    <th style={thLeft}>状態</th>
                    <th style={thRight}>合計</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const active = d.id === selectedId;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        style={{
                          cursor: "pointer",
                          background: active ? "#f6f8ff" : "transparent",
                        }}
                        title={d.id}
                      >
                        <td style={tdLeft}>{new Date(d.createdAt).toLocaleString("ja-JP")}</td>
                        <td style={tdLeft}>{d.customerName ?? "-"}</td>
                        <td style={tdLeft}>{d.kind === "invoice" ? "請求" : "見積"}</td>
                        <td style={tdLeft}>{d.status === "issued" ? "発行済み" : "下書き"}</td>
                        <td style={tdRight}>{formatYen(d.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 詳細 */}
        <section style={{ border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 700 }}>詳細</div>

          {!selected ? (
            <div style={{ padding: 12, color: "#666" }}>左の一覧から選択してください</div>
          ) : (
            <div style={{ padding: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <div><b>ID:</b> {selected.id}</div>
                <div><b>作成:</b> {new Date(selected.createdAt).toLocaleString("ja-JP")}</div>
                <div><b>顧客:</b> {selected.customerName ?? "-"}</div>
                <div><b>種別:</b> {selected.kind === "invoice" ? "請求" : "見積"}</div>
                <div><b>状態:</b> {selected.status === "issued" ? "発行済み" : "下書き"}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {selected.status !== "issued" && (
                  <button type="button" onClick={() => markIssued(selected.id)} style={{ padding: "8px 10px" }}>
                    発行済みにする
                  </button>
                )}
                <button type="button" onClick={() => removeDraft(selected.id)} style={{ padding: "8px 10px" }}>
                  削除
                </button>
              </div>

              <div style={{ marginBottom: 8, fontWeight: 700 }}>明細</div>
              {selected.lines.length === 0 ? (
                <div style={{ color: "#666" }}>明細がありません</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thLeft}>名称</th>
                        <th style={thRight}>数量</th>
                        <th style={thLeft}>単位</th>
                        <th style={thRight}>単価</th>
                        <th style={thRight}>金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lines.map((ln, idx) => (
                        <tr key={`${selected.id}-${idx}`}>
                          <td style={tdLeft}>{ln.name}</td>
                          <td style={tdRight}>{ln.qty}</td>
                          <td style={tdLeft}>{ln.unit ?? "-"}</td>
                          <td style={tdRight}>{ln.unitPrice !== undefined ? formatYen(ln.unitPrice) : "-"}</td>
                          <td style={tdRight}>{ln.amount !== undefined ? formatYen(ln.amount) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 800, textAlign: "right" }}>
                合計: {formatYen(selected.total)}
              </div>
            </div>
          )}
        </section>
      </div>

      <p style={{ marginTop: 16, color: "#666", fontSize: 12 }}>
        ※この画面は localStorage 版MVPです（後でDB/APIへ差し替え）。
      </p>
    </main>
  );
}

const thLeft: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  color: "#666",
  borderBottom: "1px solid #eee",
  padding: "8px 6px",
  whiteSpace: "nowrap",
};

const thRight: React.CSSProperties = { ...thLeft, textAlign: "right" };

const tdLeft: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #f2f2f2",
  padding: "8px 6px",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const tdRight: React.CSSProperties = { ...tdLeft, textAlign: "right" };
