"use client";

import * as React from "react";
import { getIntegrations, updateIntegrations, type IntegrationSettings } from "@/lib/api";
import { Link2, Save, RefreshCw, ExternalLink } from "lucide-react";

const SECTIONS = [
  {
    key: "loan" as const,
    label: "ローン申込",
    desc: "車両詳細ページにローン申込ボタンを表示します。",
    color: "#3b82f6",
  },
  {
    key: "warranty" as const,
    label: "保証申込",
    desc: "車両詳細ページに保証申込ボタンを表示します。",
    color: "#10b981",
  },
  {
    key: "insurance" as const,
    label: "保険申込",
    desc: "車両詳細ページに自動車保険申込ボタンを表示します。",
    color: "#f59e0b",
  },
] as const;

type SectionKey = "loan" | "warranty" | "insurance";

function emptySettings(): IntegrationSettings {
  return {
    loan_enabled: false, loan_url: "", loan_company_name: "",
    warranty_enabled: false, warranty_url: "", warranty_company_name: "",
    insurance_enabled: false, insurance_url: "", insurance_company_name: "",
  };
}

export default function IntegrationsPage() {
  const [form, setForm] = React.useState<IntegrationSettings>(emptySettings());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getIntegrations();
      setForm({
        loan_enabled: data.loan_enabled,
        loan_url: data.loan_url ?? "",
        loan_company_name: data.loan_company_name ?? "",
        warranty_enabled: data.warranty_enabled,
        warranty_url: data.warranty_url ?? "",
        warranty_company_name: data.warranty_company_name ?? "",
        insurance_enabled: data.insurance_enabled,
        insurance_url: data.insurance_url ?? "",
        insurance_company_name: data.insurance_company_name ?? "",
      });
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  function setEnabled(key: SectionKey, v: boolean) {
    setForm((prev) => ({ ...prev, [`${key}_enabled`]: v }));
  }
  function setUrl(key: SectionKey, v: string) {
    setForm((prev) => ({ ...prev, [`${key}_url`]: v }));
  }
  function setCompany(key: SectionKey, v: string) {
    setForm((prev) => ({ ...prev, [`${key}_company_name`]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const saved = await updateIntegrations({
        ...form,
        loan_url: form.loan_url || null,
        loan_company_name: form.loan_company_name || null,
        warranty_url: form.warranty_url || null,
        warranty_company_name: form.warranty_company_name || null,
        insurance_url: form.insurance_url || null,
        insurance_company_name: form.insurance_company_name || null,
      } as IntegrationSettings);
      setForm({
        loan_enabled: saved.loan_enabled,
        loan_url: saved.loan_url ?? "",
        loan_company_name: saved.loan_company_name ?? "",
        warranty_enabled: saved.warranty_enabled,
        warranty_url: saved.warranty_url ?? "",
        warranty_company_name: saved.warranty_company_name ?? "",
        insurance_enabled: saved.insurance_enabled,
        insurance_url: saved.insurance_url ?? "",
        insurance_company_name: saved.insurance_company_name ?? "",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #3a3a3a",
    background: "#1e1e1e",
    color: "#e0e0e0",
    fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>ローン/保証/保険設定</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            車両詳細ページに表示する外部申込ボタンを設定します
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      <div style={{ fontSize: 12, color: "#888", background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 10, padding: "10px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <ExternalLink size={13} />
        ボタンは外部URLへのリンクのみです。申込内容の管理は各社サービス側で行ってください。
      </div>

      {loading ? (
        <div style={{ color: "#666", fontSize: 14 }}>読込中…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {SECTIONS.map(({ key, label, desc, color }) => {
            const enabled = form[`${key}_enabled`] as boolean;
            return (
              <div
                key={key}
                style={{
                  background: "#2a2a2a",
                  border: `1px solid ${enabled ? color + "55" : "#3a3a3a"}`,
                  borderRadius: 14,
                  padding: 20,
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: enabled ? 16 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Link2 size={16} color={enabled ? color : "#555"} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: enabled ? "#e0e0e0" : "#888" }}>{label}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <span style={{ fontSize: 12, color: enabled ? color : "#555", fontWeight: 700 }}>
                      {enabled ? "有効" : "無効"}
                    </span>
                    <div
                      onClick={() => setEnabled(key, !enabled)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background: enabled ? color : "#3a3a3a",
                        position: "relative",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{
                        position: "absolute",
                        top: 3,
                        left: enabled ? 23 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </label>
                </div>

                {enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                        会社名（ボタンのラベルに表示）
                      </label>
                      <input
                        type="text"
                        placeholder={`例: ○○ファイナンス`}
                        value={form[`${key}_company_name`] as string}
                        onChange={(e) => setCompany(key, e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                        申込URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={form[`${key}_url`] as string}
                        onChange={(e) => setUrl(key, e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "11px 28px",
            borderRadius: 10,
            border: "none",
            background: saved ? "#10b981" : "#3b82f6",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <Save size={15} />
          {saving ? "保存中…" : saved ? "保存済み" : "保存する"}
        </button>
      </div>
    </div>
  );
}
