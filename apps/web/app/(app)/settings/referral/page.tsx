"use client";

import * as React from "react";
import { getMyCode, getMyReferrals, getMyDiscount, REFERRAL_DISCOUNT_PER_ACTIVE, type Referral, type MyDiscountInfo, type MyCodeInfo } from "@/lib/api";
import { Copy, Check, Users, TrendingDown, Star, RefreshCw } from "lucide-react";

function fmtMoney(n: number) { return `¥${n.toLocaleString()}`; }
function fmtDate(s: string | null | undefined) {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const STATUS_LABELS: Record<string, string> = { pending: "審査中（3ヶ月後に有効化）", active: "有効", cancelled: "キャンセル" };
const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", active: "#10b981", cancelled: "#6b7280" };

export default function ReferralPage() {
  const [codeInfo, setCodeInfo] = React.useState<MyCodeInfo | null>(null);
  const [referrals, setReferrals] = React.useState<Referral[]>([]);
  const [discount, setDiscount] = React.useState<MyDiscountInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [c, r, d] = await Promise.all([getMyCode(), getMyReferrals(), getMyDiscount()]);
      setCodeInfo(c); setReferrals(r); setDiscount(d);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function handleCopy() {
    if (!codeInfo?.code) return;
    navigator.clipboard.writeText(codeInfo.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>紹介・割引</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>友達の店舗を紹介して月額料金を割引</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      {/* 自分の紹介コード */}
      <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1a2e1a)", border: "1px solid #3b82f688", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#93c5fd", fontWeight: 700, marginBottom: 8 }}>あなたの紹介コード</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.12em", color: "#fff", fontFamily: "monospace", background: "#ffffff18", padding: "8px 20px", borderRadius: 10, border: "1px solid #ffffff22" }}>
            {loading ? "読込中…" : (codeInfo?.code ?? "―")}
          </div>
          <button
            onClick={handleCopy}
            disabled={!codeInfo?.code}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: copied ? "#10b981" : "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "background 0.2s" }}
          >
            {copied ? <><Check size={14} /> コピー済み</> : <><Copy size={14} /> コピー</>}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#93c5fd88", marginTop: 10 }}>
          このコードを新規登録する店舗に伝えてください。3ヶ月継続後に自動で有効化され、月額から {fmtMoney(REFERRAL_DISCOUNT_PER_ACTIVE)} 割引されます。
        </p>
      </div>

      {/* 割引状況 */}
      {discount && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888", marginBottom: 6 }}><Users size={14} color="#34d399" />有効紹介数</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>{discount.active_referrals}<span style={{ fontSize: 14, fontWeight: 600, color: "#888" }}> 店舗</span></div>
          </div>

          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888", marginBottom: 6 }}><TrendingDown size={14} color="#60a5fa" />月次割引額</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#60a5fa" }}>- {fmtMoney(discount.monthly_discount)}</div>
          </div>

          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>割引後月額</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: discount.monthly_price_after === 0 ? "#34d399" : "#e0e0e0" }}>
              {discount.monthly_price_after === 0 ? "🎉 無料！" : fmtMoney(discount.monthly_price_after)}
            </div>
            <div style={{ fontSize: 11, color: "#666", textDecoration: "line-through" }}>通常 {fmtMoney(discount.monthly_price_before)}</div>
          </div>

          {discount.free_slots_needed > 0 && (
            <div style={{ background: "#7c3aed22", border: "1px solid #7c3aed55", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#a78bfa", marginBottom: 6 }}><Star size={14} />あと何人で0円？</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#c4b5fd" }}>あと <span style={{ fontSize: 30 }}>{discount.free_slots_needed}</span> 人</div>
            </div>
          )}
        </div>
      )}

      {/* 紹介した店舗一覧 */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #3a3a3a", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={16} />
          紹介した店舗（{referrals.length}件）
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e1e1e", borderBottom: "1px solid #3a3a3a" }}>
              {["店舗名", "ステータス", "割引貢献", "有効化日", "紹介日"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {referrals.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#666" }}>まだ紹介した店舗がありません</td></tr>
            ) : referrals.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #333", background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>{r.referred_store_name}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[r.status] ?? "#888") + "22", color: STATUS_COLORS[r.status] ?? "#888" }}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: r.status === "active" ? "#34d399" : "#555", fontWeight: 700 }}>
                  {r.status === "active" ? `- ${fmtMoney(REFERRAL_DISCOUNT_PER_ACTIVE)}/月` : "―"}
                </td>
                <td style={{ padding: "10px 12px", color: "#aaa" }}>{fmtDate(r.activated_at)}</td>
                <td style={{ padding: "10px 12px", color: "#aaa" }}>{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
