"use client";

import * as React from "react";
import Link from "next/link";
import { listMyInvoices, PLAN_PRICES, type LicenseInvoice, type InvoiceStatus } from "@/lib/api";
import { FileText, Printer, TrendingDown, RefreshCw } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateJp(s: string | null | undefined): string {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString()}`;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:     { label: "下書き",    color: "#888" },
  issued:    { label: "お支払い待ち", color: "#3b82f6" },
  paid:      { label: "支払済み",  color: "#10b981" },
  cancelled: { label: "キャンセル", color: "#ef4444" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#888" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}55` }}>
      {cfg.label}
    </span>
  );
}

// ─── Yearly Upsell Banner ─────────────────────────────────────────────────────

function YearlyBanner({ plan }: { plan: string }) {
  const prices = PLAN_PRICES[plan];
  if (!prices) return null;

  const monthlyTotal = prices.monthly * 12;
  const discount = monthlyTotal - prices.yearly;

  return (
    <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1e4d3a)", border: "1px solid #3b82f688", borderRadius: 14, padding: 20, marginBottom: 24, color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <TrendingDown size={18} color="#34d399" />
        <span style={{ fontWeight: 800, fontSize: 15, color: "#34d399" }}>年払いに切り替えてお得に！</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div style={{ background: "#ffffff11", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>月払い（12ヶ月合計）</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMoney(monthlyTotal)}</div>
          <div style={{ fontSize: 12, color: "#aaa" }}>{fmtMoney(prices.monthly)} × 12ヶ月</div>
        </div>
        <div style={{ background: "#10b98122", borderRadius: 10, padding: "12px 16px", border: "1px solid #10b98155" }}>
          <div style={{ fontSize: 11, color: "#34d399", marginBottom: 4 }}>年払い（10%割引）</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>{fmtMoney(prices.yearly)}</div>
          <div style={{ fontSize: 12, color: "#86efac" }}>
            <strong style={{ fontSize: 14 }}>{fmtMoney(discount)}</strong> お得！（約2ヶ月分）
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>
        年払いへの切り替えは担当者にお問い合わせください。
        切り替え後の初回請求時に年間利用料を一括請求します。
      </p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsInvoicesPage() {
  const [invoices, setInvoices] = React.useState<LicenseInvoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 現在のプランを最新請求書から推定
  const currentPlan = invoices[0]?.plan ?? "starter";
  const currentCycle = invoices[0]?.billing_cycle ?? "monthly";
  const isYearly = currentCycle === "yearly";

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMyInvoices();
      setInvoices(data);
    } catch (e: any) {
      setError(e?.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>請求書・領収書</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>自店舗へのライセンス請求書を確認できます</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          <RefreshCw size={14} />
          更新
        </button>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d33", border: "1px solid #ef4444", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* 年払いバナー（月払いの場合のみ表示） */}
      {!isYearly && invoices.length > 0 && <YearlyBanner plan={currentPlan} />}

      {/* 年払い利用中バッジ */}
      {isYearly && (
        <div style={{ background: "#10b98122", border: "1px solid #10b98155", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#34d399", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingDown size={16} />
          年払いプランをご利用中です（10%割引適用）
        </div>
      )}

      {/* 請求書一覧 */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #3a3a3a", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <FileText size={16} />
          請求書一覧（{invoices.length} 件）
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3a3a3a", background: "#1e1e1e" }}>
                {["書類番号", "種別", "サイクル", "金額（税込）", "対象期間", "ステータス", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#666" }}>
                    {loading ? "読み込み中…" : "請求書がありません"}
                  </td>
                </tr>
              ) : (
                invoices.map((inv, idx) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #333", background: idx % 2 === 0 ? "transparent" : "#ffffff08" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <span style={{ color: "#60a5fa" }}>{inv.invoice_number}</span>
                    </td>
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
                        ? `${fmtDateJp(inv.period_from)}〜${fmtDateJp(inv.period_to)}`
                        : "―"}
                    </td>
                    <td style={{ padding: "10px 12px" }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: "10px 12px" }}>
                      <Link href={`/admin/invoices/${inv.id}/print`}>
                        <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #3a3a3a", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}>
                          <Printer size={12} /> PDF印刷
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 設定に戻るリンク */}
      <div style={{ marginTop: 20 }}>
        <Link href="/settings" style={{ color: "#60a5fa", fontSize: 13, textDecoration: "none" }}>
          ← 設定に戻る
        </Link>
      </div>
    </div>
  );
}
