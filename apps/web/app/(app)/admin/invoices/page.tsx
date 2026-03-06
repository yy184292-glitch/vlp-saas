"use client";

import * as React from "react";
import Link from "next/link";
import {
  listLicenseInvoices,
  createLicenseInvoice,
  markInvoicePaid,
  cancelInvoice,
  listLicenses,
  PLAN_PRICES,
  PLAN_LABELS,
  type LicenseInvoice,
  type InvoiceStatus,
  type InvoiceBillingCycle,
  type License,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, FileText, CheckCircle, XCircle, Printer } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:     { label: "下書き",   color: "#888" },
  issued:    { label: "発行済み", color: "#3b82f6" },
  paid:      { label: "支払済み", color: "#10b981" },
  cancelled: { label: "キャンセル", color: "#ef4444" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#888" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 700,
        background: cfg.color + "22",
        color: cfg.color,
        border: `1px solid ${cfg.color}55`,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Issue Dialog ─────────────────────────────────────────────────────────────

function IssueDialog({
  licenses,
  onClose,
  onCreated,
}: {
  licenses: License[];
  onClose: () => void;
  onCreated: (inv: LicenseInvoice) => void;
}) {
  const [licenseId, setLicenseId] = React.useState(licenses[0]?.id ?? "");
  const [docType, setDocType] = React.useState<"invoice" | "receipt">("invoice");
  const [billingCycle, setBillingCycle] = React.useState<InvoiceBillingCycle>("monthly");
  const [customAmount, setCustomAmount] = React.useState("");
  const [periodFrom, setPeriodFrom] = React.useState("");
  const [periodTo, setPeriodTo] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedLic = licenses.find((l) => l.id === licenseId);
  const planKey = selectedLic?.plan ?? "starter";
  const suggestedAmount = PLAN_PRICES[planKey]?.[billingCycle] ?? 0;
  const amount = customAmount ? parseInt(customAmount, 10) : suggestedAmount;
  const tax = Math.floor(amount * 0.1);

  async function handleSubmit() {
    if (!licenseId) return;
    setSaving(true);
    setError(null);
    try {
      const inv = await createLicenseInvoice({
        license_id: licenseId,
        type: docType,
        billing_cycle: billingCycle,
        amount,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        due_date: dueDate || null,
        note: note || null,
      });
      onCreated(inv);
    } catch (e: any) {
      setError(e?.message ?? "発行に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    height: 38,
    width: "100%",
    borderRadius: 8,
    border: "1px solid #444",
    background: "#1a1a1a",
    color: "#e0e0e0",
    padding: "0 10px",
    fontSize: 13,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 16, padding: 24, color: "#e0e0e0", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>請求書・領収書を発行</h2>

        {error && (
          <div style={{ background: "#7f1d1d33", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>店舗 / ライセンス</div>
            <select value={licenseId} onChange={(e) => setLicenseId(e.target.value)} style={inputStyle}>
              {licenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.store_name}（{PLAN_LABELS[l.plan] ?? l.plan}）
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>書類種別</div>
              <select value={docType} onChange={(e) => setDocType(e.target.value as any)} style={inputStyle}>
                <option value="invoice">請求書</option>
                <option value="receipt">領収書</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>請求サイクル</div>
              <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as any)} style={inputStyle}>
                <option value="monthly">月払い</option>
                <option value="yearly">年払い（10%割引）</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>
              金額（税抜）— 標準: {fmtMoney(suggestedAmount)}
            </div>
            <input
              type="number"
              placeholder={String(suggestedAmount)}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
              消費税（10%）: {fmtMoney(tax)} → 合計: {fmtMoney(amount + tax)}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>期間（開始）</div>
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>期間（終了）</div>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>支払期限</div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>備考</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              style={{ ...inputStyle, height: "auto", padding: "8px 10px", resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid #444", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !licenseId}
            style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "発行中…" : "発行する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = React.useState<LicenseInvoice[]>([]);
  const [licenses, setLicenses] = React.useState<License[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showIssue, setShowIssue] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<"all" | InvoiceStatus>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invData, licData] = await Promise.all([listLicenseInvoices(), listLicenses()]);
      setInvoices(invData);
      setLicenses(licData);
    } catch (e: any) {
      setError(e?.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function handleMarkPaid(inv: LicenseInvoice) {
    if (!confirm(`「${inv.invoice_number}」を支払済みにしますか？`)) return;
    try {
      const updated = await markInvoicePaid(inv.id);
      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e: any) { alert(e?.message ?? "失敗しました"); }
  }

  async function handleCancel(inv: LicenseInvoice) {
    if (!confirm(`「${inv.invoice_number}」をキャンセルしますか？`)) return;
    try {
      const updated = await cancelInvoice(inv.id);
      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e: any) { alert(e?.message ?? "失敗しました"); }
  }

  const filtered = invoices.filter(
    (i) => filterStatus === "all" || i.status === filterStatus
  );

  const counts: Record<string, number> = { all: invoices.length };
  for (const i of invoices) counts[i.status] = (counts[i.status] ?? 0) + 1;

  const cardStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: 12,
    border: active ? "1px solid #3b82f6" : "1px solid #3a3a3a",
    background: active ? "#3b82f633" : "#2a2a2a",
    padding: "10px 16px",
    cursor: "pointer",
    textAlign: "left",
    color: "#e0e0e0",
    minWidth: 90,
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      {showIssue && (
        <IssueDialog
          licenses={licenses.filter((l) => l.status !== "suspended")}
          onClose={() => setShowIssue(false)}
          onCreated={(inv) => {
            setInvoices((prev) => [inv, ...prev]);
            setShowIssue(false);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>請求書・領収書管理</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>ライセンス料の請求書・領収書を発行・管理します（superadmin専用）</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> 更新
          </button>
          <button onClick={() => setShowIssue(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Plus size={14} /> 新規発行
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d33", border: "1px solid #ef4444", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["all", "issued", "paid", "cancelled", "draft"] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} style={cardStyle(filterStatus === s)}>
            <div style={{ fontSize: 11, fontWeight: 700, color: filterStatus === s ? "#93c5fd" : "#888" }}>
              {s === "all" ? "全て" : STATUS_CONFIG[s]?.label ?? s}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{counts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3a3a3a", background: "#1e1e1e" }}>
                {["請求書番号", "店舗名", "種別", "サイクル", "金額（税込）", "対象期間", "支払期限", "ステータス", "操作"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "#666" }}>
                    {loading ? "読み込み中…" : "データがありません"}
                  </td>
                </tr>
              ) : (
                filtered.map((inv, idx) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #333", background: idx % 2 === 0 ? "transparent" : "#ffffff08" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                      <Link href={`/admin/invoices/${inv.id}/print`} style={{ color: "#60a5fa", textDecoration: "none" }}>
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{inv.store_name}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: inv.type === "receipt" ? "#7c3aed22" : "#0369a122", color: inv.type === "receipt" ? "#a78bfa" : "#38bdf8" }}>
                        {inv.type === "receipt" ? "領収書" : "請求書"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#aaa" }}>
                      {inv.billing_cycle === "yearly" ? "年払い" : "月払い"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>{fmtMoney(inv.total_amount)}</td>
                    <td style={{ padding: "10px 12px", color: "#aaa", whiteSpace: "nowrap" }}>
                      {inv.period_from && inv.period_to
                        ? `${fmtDate(inv.period_from)}〜${fmtDate(inv.period_to)}`
                        : "―"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#aaa", whiteSpace: "nowrap" }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/admin/invoices/${inv.id}/print`}>
                          <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #3a3a3a", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                            <Printer size={12} /> 印刷
                          </button>
                        </Link>
                        {inv.status === "issued" && (
                          <button onClick={() => handleMarkPaid(inv)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #10b98155", background: "#10b98122", color: "#34d399", fontSize: 12, cursor: "pointer" }}>
                            <CheckCircle size={12} /> 支払済み
                          </button>
                        )}
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <button onClick={() => handleCancel(inv)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #ef444455", background: "#ef444422", color: "#f87171", fontSize: 12, cursor: "pointer" }}>
                            <XCircle size={12} /> キャンセル
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
