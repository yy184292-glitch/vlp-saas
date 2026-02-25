"use client";

import React, { useEffect, useMemo, useState } from "react";

type BillingStatus = "draft" | "issued";
type BillingKind = "estimate" | "invoice";

/**
 * MVP想定の BillingDraft 形
 * - 実データのフィールド名が違っても壊れないように、読み込み時に正規化します。
 */
type BillingDraft = {
  id: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  status: BillingStatus;
  kind: BillingKind;
  customerName?: string;
  total: number; // tax込み/税抜きは現状不問（MVP）
  lineCount: number;
};

const STORAGE_KEY = "vlp_billing_drafts_v1";

/** 安全に JSON を読む */
function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("JSON parse failed:", e);
    return null;
  }
}

/** Date -> yyyy-mm-dd */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-dd -> Date(00:00:00 local) */
function fromYmd(ymd: string): Date | null {
  // input[type=date] の値は yyyy-mm-dd 固定
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function clampNumber(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * どんな形で保存されていても、壊れにくく BillingDraft へ寄せる
 * （キー名が違っても最低限表示できるように）
 */
function normalizeDraft(raw: any): BillingDraft | null {
  if (!raw || typeof raw !== "object") return null;

  const id = String(raw.id ?? raw.draftId ?? "").trim();
  if (!id) return null;

  const createdAt = String(raw.createdAt ?? raw.created_at ?? raw.created ?? "");
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? raw.updated;

  const statusRaw = String(raw.status ?? "draft");
  const status: BillingStatus = statusRaw === "issued" ? "issued" : "draft";

  const kindRaw = String(raw.kind ?? raw.type ?? "invoice");
  const kind: BillingKind = kindRaw === "estimate" ? "estimate" : "invoice";

  const customerName = raw.customerName ?? raw.customer_name ?? raw.customer;

  // totals: total / grandTotal / amount / totalAmount 等を吸収
  const total =
    clampNumber(raw.total, NaN) ??
    clampNumber(raw.grandTotal, NaN) ??
    clampNumber(raw.amount, NaN) ??
    clampNumber(raw.totalAmount, NaN);

  const fixedTotal = Number.isFinite(total) ? total : 0;

  const lines = raw.lines ?? raw.items ?? raw.details ?? [];
  const lineCount = Array.isArray(lines) ? lines.length : 0;

  // createdAt が不正なら updatedAt を使う
  const created = new Date(createdAt);
  const createdIso = Number.isNaN(created.getTime())
    ? (() => {
        const u = updatedAt ? new Date(String(updatedAt)) : null;
        return u && !Number.isNaN(u.getTime()) ? u.toISOString() : new Date().toISOString();
      })()
    : created.toISOString();

  return {
    id,
    createdAt: createdIso,
    updatedAt: updatedAt ? String(updatedAt) : undefined,
    status,
    kind,
    customerName: customerName ? String(customerName) : undefined,
    total: fixedTotal,
    lineCount,
  };
}

function formatYen(n: number): string {
  try {
    return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
  } catch {
    return `¥${Math.round(n).toLocaleString()}`;
  }
}

type StatusFilter = "all" | BillingStatus;
type KindFilter = "all" | BillingKind;

export default function Page() {
  // 初期期間: 今月1日〜今日
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [fromYmdValue, setFromYmdValue] = useState<string>(() => toYmd(initialFrom));
  const [toYmdValue, setToYmdValue] = useState<string>(() => toYmd(today));

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("issued"); // 売上なら issued がデフォ
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const [allDrafts, setAllDrafts] = useState<BillingDraft[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLoadError(null);
      const parsed = safeJsonParse<any[]>(localStorage.getItem(STORAGE_KEY)) ?? [];
      const normalized = parsed
        .map((x) => normalizeDraft(x))
        .filter((x): x is BillingDraft => x !== null);

      // 新しい順
      normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllDrafts(normalized);
    } catch (e) {
      console.error(e);
      setAllDrafts([]);
      setLoadError("レポート用データの読み込みに失敗しました（localStorage）。");
    }
  }, []);

  const { filteredDrafts, fromDate, toDate } = useMemo(() => {
    const from = fromYmd(fromYmdValue) ?? initialFrom;
    const to = fromYmd(toYmdValue) ?? today;

    // to は当日23:59:59 まで含めたい
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

    const list = allDrafts.filter((d) => {
      const t = new Date(d.createdAt).getTime();
      if (Number.isNaN(t)) return false;

      if (t < from.getTime()) return false;
      if (t > toEnd.getTime()) return false;

      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (kindFilter !== "all" && d.kind !== kindFilter) return false;

      return true;
    });

    return { filteredDrafts: list, fromDate: from, toDate: to };
  }, [allDrafts, fromYmdValue, toYmdValue, statusFilter, kindFilter, initialFrom, today]);

  const summary = useMemo(() => {
    const count = filteredDrafts.length;
    const total = filteredDrafts.reduce((acc, d) => acc + d.total, 0);
    const avg = count > 0 ? total / count : 0;

    // 日別集計
    const byDay = new Map<string, { ymd: string; count: number; total: number }>();
    for (const d of filteredDrafts) {
      const dt = new Date(d.createdAt);
      const key = toYmd(dt);
      const cur = byDay.get(key) ?? { ymd: key, count: 0, total: 0 };
      cur.count += 1;
      cur.total += d.total;
      byDay.set(key, cur);
    }
    const dayRows = Array.from(byDay.values()).sort((a, b) => (a.ymd < b.ymd ? 1 : -1)); // 新しい日付順

    return { count, total, avg, dayRows };
  }, [filteredDrafts]);

  const setQuickRange = (mode: "thisMonth" | "last7" | "last30") => {
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
    if (mode === "last30") {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      setFromYmdValue(toYmd(start));
      setToYmdValue(toYmd(now));
    }
  };

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>売上レポート</h1>

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
              <option value="issued">発行済み（売上）</option>
              <option value="draft">下書き</option>
              <option value="all">すべて</option>
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
          期間: {toYmd(fromDate)} 〜 {toYmd(toDate)} / データ: localStorage（{STORAGE_KEY}）
        </div>

        {loadError && (
          <div style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>
            {loadError}
          </div>
        )}
      </section>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Card title="件数" value={`${summary.count} 件`} />
        <Card title="合計" value={formatYen(summary.total)} />
        <Card title="平均" value={formatYen(summary.avg)} />
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>日別集計</h2>

        {summary.dayRows.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>対象データがありません</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thLeft}>日付</th>
                  <th style={thRight}>件数</th>
                  <th style={thRight}>合計</th>
                </tr>
              </thead>
              <tbody>
                {summary.dayRows.map((r) => (
                  <tr key={r.ymd}>
                    <td style={tdLeft}>{r.ymd}</td>
                    <td style={tdRight}>{r.count}</td>
                    <td style={tdRight}>{formatYen(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>明細（請求/見積）</h2>

        {filteredDrafts.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>対象データがありません</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thLeft}>作成日</th>
                  <th style={thLeft}>ID</th>
                  <th style={thLeft}>顧客</th>
                  <th style={thLeft}>種別</th>
                  <th style={thLeft}>状態</th>
                  <th style={thRight}>明細数</th>
                  <th style={thRight}>合計</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((d) => (
                  <tr key={d.id}>
                    <td style={tdLeft}>{new Date(d.createdAt).toLocaleString("ja-JP")}</td>
                    <td style={tdLeft}>{d.id}</td>
                    <td style={tdLeft}>{d.customerName ?? "-"}</td>
                    <td style={tdLeft}>{d.kind === "invoice" ? "請求" : "見積"}</td>
                    <td style={tdLeft}>{d.status === "issued" ? "発行済み" : "下書き"}</td>
                    <td style={tdRight}>{d.lineCount}</td>
                    <td style={tdRight}>{formatYen(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
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

const thRight: React.CSSProperties = {
  ...thLeft,
  textAlign: "right",
};

const tdLeft: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #f2f2f2",
  padding: "8px 6px",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const tdRight: React.CSSProperties = {
  ...tdLeft,
  textAlign: "right",
};
