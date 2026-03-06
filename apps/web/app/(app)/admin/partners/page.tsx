"use client";

import * as React from "react";
import Link from "next/link";
import {
  listPartners, createPartner, updatePartner, deletePartner,
  listLicenses,
  RANK_LABELS, RANK_COLORS,
  type Partner, type PartnerRank, type ServiceType, type License,
} from "@/lib/api";
import { Plus, RefreshCw, Pencil, Trash2, ExternalLink } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: PartnerRank }) {
  const color = RANK_COLORS[rank];
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: color + "22", color, border: `1px solid ${color}55` }}>
      {RANK_LABELS[rank]}
    </span>
  );
}

const SERVICE_OPTIONS = [
  { value: "", label: "なし" },
  { value: "own", label: "自社" },
  { value: "partner", label: "提携" },
] as const;

// ─── Create/Edit Dialog ───────────────────────────────────────────────────────

function PartnerDialog({
  partner,
  licenses,
  onClose,
  onSaved,
}: {
  partner: Partner | null;
  licenses: License[];
  onClose: () => void;
  onSaved: (p: Partner) => void;
}) {
  const isEdit = !!partner;
  const [storeId, setStoreId] = React.useState(partner?.store_id ?? "");
  const [name, setName] = React.useState(partner?.name ?? "");
  const [rank, setRank] = React.useState<PartnerRank>(partner?.rank ?? "silver");
  const [loanType, setLoanType] = React.useState<string>(partner?.loan_type ?? "");
  const [insuranceType, setInsuranceType] = React.useState<string>(partner?.insurance_type ?? "");
  const [warrantyType, setWarrantyType] = React.useState<string>(partner?.warranty_type ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    height: 38, width: "100%", borderRadius: 8, border: "1px solid #444",
    background: "#1a1a1a", color: "#e0e0e0", padding: "0 10px", fontSize: 13,
  };

  async function handleSubmit() {
    setSaving(true); setError(null);
    try {
      const toNull = (v: string) => (v === "" ? null : (v as ServiceType));
      if (isEdit) {
        const updated = await updatePartner(partner!.id, { name, rank, loan_type: toNull(loanType), insurance_type: toNull(insuranceType), warranty_type: toNull(warrantyType) });
        onSaved(updated);
      } else {
        const created = await createPartner({ store_id: storeId, name, rank, loan_type: toNull(loanType), insurance_type: toNull(insuranceType), warranty_type: toNull(warrantyType) });
        onSaved(created);
      }
    } catch (e: any) { setError(e?.message ?? "保存に失敗しました"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 16, padding: 24, color: "#e0e0e0", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>{isEdit ? "パートナー編集" : "パートナー新規登録"}</h2>

        {error && <div style={{ background: "#7f1d1d33", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!isEdit && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>店舗選択</div>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={inputStyle}>
                <option value="">-- 店舗を選択 --</option>
                {licenses.map((l) => (
                  <option key={l.store_id} value={l.store_id}>{l.store_name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>パートナー名</div>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="例: 株式会社〇〇" />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>ランク</div>
            <select value={rank} onChange={(e) => setRank(e.target.value as PartnerRank)} style={inputStyle}>
              <option value="silver">シルバー</option>
              <option value="gold">ゴールド</option>
              <option value="platinum">プラチナ</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "ローン", state: loanType, set: setLoanType },
              { label: "保険", state: insuranceType, set: setInsuranceType },
              { label: "保証", state: warrantyType, set: setWarrantyType },
            ].map(({ label, state, set }) => (
              <div key={label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>{label}</div>
                <select value={state} onChange={(e) => set(e.target.value)} style={inputStyle}>
                  {SERVICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid #444", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>キャンセル</button>
          <button onClick={handleSubmit} disabled={saving || (!isEdit && !storeId)} style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  const [partners, setPartners] = React.useState<Partner[]>([]);
  const [licenses, setLicenses] = React.useState<License[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<"create" | Partner | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pd, ld] = await Promise.all([listPartners(), listLicenses()]);
      setPartners(pd); setLicenses(ld);
    } catch (e: any) { setError(e?.message ?? "読み込みに失敗しました"); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function handleDelete(p: Partner) {
    if (!confirm(`「${p.name}」を削除しますか？`)) return;
    try { await deletePartner(p.id); setPartners((prev) => prev.filter((x) => x.id !== p.id)); }
    catch (e: any) { alert(e?.message ?? "削除に失敗しました"); }
  }

  const SERVICE_LABEL: Record<string, string> = { own: "自社", partner: "提携" };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      {dialog && (
        <PartnerDialog
          partner={dialog === "create" ? null : dialog}
          licenses={licenses}
          onClose={() => setDialog(null)}
          onSaved={(p) => {
            setPartners((prev) => dialog === "create" ? [p, ...prev] : prev.map((x) => x.id === p.id ? p : x));
            setDialog(null);
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>パートナー管理</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>パートナー店舗の登録・管理（superadmin専用）</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <RefreshCw size={14} /> 更新
          </button>
          <button onClick={() => setDialog("create")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            <Plus size={14} /> 新規登録
          </button>
        </div>
      </div>

      {error && <div style={{ background: "#7f1d1d33", border: "1px solid #ef4444", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>{error}</div>}

      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #3a3a3a", background: "#1e1e1e" }}>
                {["パートナー名", "コード", "ランク", "紹介店舗数", "ローン", "保険", "保証", "状態", "操作"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "#666" }}>{loading ? "読み込み中…" : "データがありません"}</td></tr>
              ) : (
                partners.map((p, idx) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #333", background: idx % 2 === 0 ? "transparent" : "#ffffff08" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                      <Link href={`/admin/partners/${p.id}`} style={{ color: "#60a5fa", textDecoration: "none" }}>{p.name}</Link>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#34d399" }}>{p.code}</td>
                    <td style={{ padding: "10px 12px" }}><RankBadge rank={p.rank} /></td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{p.referral_count}</td>
                    {[p.loan_type, p.insurance_type, p.warranty_type].map((t, i) => (
                      <td key={i} style={{ padding: "10px 12px", color: t ? "#e0e0e0" : "#555" }}>{t ? SERVICE_LABEL[t] ?? t : "―"}</td>
                    ))}
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.is_active ? "#10b98122" : "#55555522", color: p.is_active ? "#34d399" : "#888" }}>
                        {p.is_active ? "有効" : "停止"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Link href={`/admin/partners/${p.id}`}>
                          <button style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #3a3a3a", background: "transparent", color: "#aaa", fontSize: 12, cursor: "pointer" }}><ExternalLink size={12} /> 詳細</button>
                        </Link>
                        <button onClick={() => setDialog(p)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #3b82f655", background: "#3b82f622", color: "#60a5fa", fontSize: 12, cursor: "pointer" }}><Pencil size={12} /> 編集</button>
                        <button onClick={() => handleDelete(p)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, border: "1px solid #ef444455", background: "#ef444422", color: "#f87171", fontSize: 12, cursor: "pointer" }}><Trash2 size={12} /> 削除</button>
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
