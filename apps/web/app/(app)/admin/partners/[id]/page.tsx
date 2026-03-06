"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getPartner, getPartnerStats, getPartnerStores, RANK_LABELS, RANK_COLORS, type Partner, type PartnerStats, type PartnerStore } from "@/lib/api";
import { ArrowLeft, Users, TrendingUp, Star } from "lucide-react";

function fmtMoney(n: number) { return `¥${n.toLocaleString()}`; }
function fmtDate(s: string | null | undefined) {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const STATUS_COLORS: Record<string, string> = { pending: "#f59e0b", active: "#10b981", cancelled: "#6b7280" };
const STATUS_LABELS: Record<string, string> = { pending: "審査中", active: "有効", cancelled: "キャンセル" };

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const [partner, setPartner] = React.useState<Partner | null>(null);
  const [stats, setStats] = React.useState<PartnerStats | null>(null);
  const [stores, setStores] = React.useState<PartnerStore[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    const id = params.id;
    setLoading(true);
    Promise.all([getPartner(id), getPartnerStats(id), getPartnerStores(id)])
      .then(([p, s, st]) => { setPartner(p); setStats(s); setStores(st); })
      .catch((e) => setError(e?.message ?? "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) return <div style={{ padding: 40, color: "#888", textAlign: "center" }}>読み込み中…</div>;
  if (error) return <div style={{ padding: 40, color: "#ef4444", textAlign: "center" }}>{error}</div>;
  if (!partner) return null;

  const rankColor = RANK_COLORS[partner.rank];
  const SERVICE_LABEL: Record<string, string> = { own: "自社", partner: "提携" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <Link href="/admin/partners" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#60a5fa", fontSize: 13, textDecoration: "none", marginBottom: 20 }}>
        <ArrowLeft size={14} /> パートナー一覧に戻る
      </Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{partner.name}</h1>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{partner.store_name}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 99, fontWeight: 800, fontSize: 13, background: rankColor + "22", color: rankColor, border: `1px solid ${rankColor}55` }}>
            <Star size={14} fill={rankColor} /> {RANK_LABELS[partner.rank]}
          </span>
          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#34d399", background: "#10b98122", padding: "4px 12px", borderRadius: 8, border: "1px solid #10b98155" }}>
            {partner.code}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "有効紹介店舗数", value: `${stats.active_referrals}店舗`, icon: <Users size={16} color="#34d399" /> },
            { label: "審査中", value: `${stats.pending_referrals}店舗`, icon: <Users size={16} color="#f59e0b" /> },
            { label: "月次割引発生額", value: fmtMoney(stats.monthly_discount), icon: <TrendingUp size={16} color="#60a5fa" /> },
            { label: "累計割引発生額(年間概算)", value: fmtMoney(stats.total_discount_generated), icon: <TrendingUp size={16} color="#a78bfa" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888", marginBottom: 6 }}>{icon}{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 基本情報 */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>基本情報</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13 }}>
          {[
            { label: "ローン", value: partner.loan_type ? SERVICE_LABEL[partner.loan_type] : "なし" },
            { label: "保険", value: partner.insurance_type ? SERVICE_LABEL[partner.insurance_type] : "なし" },
            { label: "保証", value: partner.warranty_type ? SERVICE_LABEL[partner.warranty_type] : "なし" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
              <div style={{ fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 紹介店舗一覧 */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #3a3a3a", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={16} /> 紹介した店舗一覧（{stores.length}件）
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e1e1e", borderBottom: "1px solid #3a3a3a" }}>
              {["店舗名", "ステータス", "有効化日", "紹介日"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stores.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#666" }}>紹介した店舗はありません</td></tr>
            ) : stores.map((s, i) => (
              <tr key={s.referral_id} style={{ borderBottom: "1px solid #333", background: i % 2 === 0 ? "transparent" : "#ffffff08" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>{s.store_name}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[s.status] ?? "#888") + "22", color: STATUS_COLORS[s.status] ?? "#888" }}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "#aaa" }}>{fmtDate(s.activated_at)}</td>
                <td style={{ padding: "10px 12px", color: "#aaa" }}>{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
