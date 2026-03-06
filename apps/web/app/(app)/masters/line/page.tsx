"use client";

import * as React from "react";
import {
  getLineSettings,
  updateLineSettings,
  testLineConnection,
  type LineSetting,
} from "@/lib/api";
import { Save, Copy, Check, RefreshCw, Wifi, WifiOff, MessageCircle } from "lucide-react";

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #3a3a3a",
    background: "#1e1e1e",
    color: "#e0e0e0",
    fontSize: 13,
    boxSizing: "border-box",
    ...extra,
  };
}

export default function LineSettingsPage() {
  const [form, setForm] = React.useState<Partial<LineSetting>>({
    channel_access_token: "",
    channel_secret: "",
    liff_id: "",
    auto_reply_enabled: false,
    auto_reply_message: "",
    welcome_message: "",
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ status: string; bot_name?: string; detail?: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);
  const [storeId, setStoreId] = React.useState<string>("");

  const webhookUrl = storeId
    ? `${typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host.replace("3000", "8000")}` : "https://api.example.com"}/api/v1/line/webhook?store_id=${storeId}`
    : "（ストアIDを取得中…）";

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await getLineSettings();
        setStoreId(s.store_id ?? "");
        setForm({
          channel_access_token: s.channel_access_token ?? "",
          channel_secret: s.channel_secret ?? "",
          liff_id: s.liff_id ?? "",
          auto_reply_enabled: s.auto_reply_enabled,
          auto_reply_message: s.auto_reply_message ?? "",
          welcome_message: s.welcome_message ?? "",
        });
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateLineSettings({
        channel_access_token: form.channel_access_token || null,
        channel_secret: form.channel_secret || null,
        liff_id: form.liff_id || null,
        auto_reply_enabled: form.auto_reply_enabled,
        auto_reply_message: form.auto_reply_message || null,
        welcome_message: form.welcome_message || null,
      } as LineSetting);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { alert("保存に失敗しました"); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testLineConnection();
      setTestResult(r);
    } catch { setTestResult({ status: "error", detail: "接続テストに失敗しました" }); }
    finally { setTesting(false); }
  }

  function handleCopyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    });
  }

  const set = (k: keyof typeof form, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <MessageCircle size={22} color="#06b6d4" />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>LINE設定</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 2 }}>LINE Messaging API との連携設定</p>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#666" }}>読込中…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* API 認証情報 */}
          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>API 認証情報</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Channel Access Token
                </label>
                <input
                  type="password"
                  value={form.channel_access_token ?? ""}
                  onChange={e => set("channel_access_token", e.target.value)}
                  placeholder="LINE Developers Console で取得"
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  Channel Secret
                </label>
                <input
                  type="password"
                  value={form.channel_secret ?? ""}
                  onChange={e => set("channel_secret", e.target.value)}
                  placeholder="Webhook 署名検証に使用"
                  style={inputStyle()}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  LIFF ID（任意）
                </label>
                <input
                  type="text"
                  value={form.liff_id ?? ""}
                  onChange={e => set("liff_id", e.target.value)}
                  placeholder="1234567890-xxxxxxxx"
                  style={inputStyle()}
                />
              </div>
            </div>

            {/* 接続テスト */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={handleTest}
                disabled={testing || !form.channel_access_token}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              >
                <RefreshCw size={13} />
                {testing ? "テスト中…" : "接続テスト"}
              </button>
              {testResult && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  {testResult.status === "ok" ? (
                    <><Wifi size={14} color="#10b981" /><span style={{ color: "#10b981" }}>接続OK: {testResult.bot_name}</span></>
                  ) : (
                    <><WifiOff size={14} color="#ef4444" /><span style={{ color: "#ef4444" }}>{testResult.detail}</span></>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Webhook URL */}
          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Webhook URL</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              LINE Developers Console の「Webhook URL」に以下を設定してください。
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code style={{ flex: 1, fontSize: 11, background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: 8, padding: "8px 12px", color: "#93c5fd", wordBreak: "break-all" }}>
                {webhookUrl}
              </code>
              <button
                onClick={handleCopyWebhook}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "none", background: copiedWebhook ? "#10b981" : "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {copiedWebhook ? <><Check size={12} /> コピー済み</> : <><Copy size={12} /> コピー</>}
              </button>
            </div>
          </div>

          {/* 自動返信 */}
          <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>自動返信</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 12, color: form.auto_reply_enabled ? "#10b981" : "#555", fontWeight: 700 }}>
                  {form.auto_reply_enabled ? "有効" : "無効"}
                </span>
                <div
                  onClick={() => set("auto_reply_enabled", !form.auto_reply_enabled)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: form.auto_reply_enabled ? "#10b981" : "#3a3a3a", position: "relative", cursor: "pointer", transition: "background 0.2s" }}
                >
                  <div style={{ position: "absolute", top: 3, left: form.auto_reply_enabled ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>自動返信メッセージ</label>
                <textarea
                  value={form.auto_reply_message ?? ""}
                  onChange={e => set("auto_reply_message", e.target.value)}
                  placeholder="メッセージを受信した際に自動で返信するテキスト"
                  rows={3}
                  style={{ ...inputStyle(), resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>友だち追加時ウェルカムメッセージ</label>
                <textarea
                  value={form.welcome_message ?? ""}
                  onChange={e => set("welcome_message", e.target.value)}
                  placeholder="友だち追加時に自動送信されるメッセージ"
                  rows={3}
                  style={{ ...inputStyle(), resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 28px", borderRadius: 10, border: "none", background: saved ? "#10b981" : "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "background 0.2s" }}
            >
              <Save size={15} />
              {saving ? "保存中…" : saved ? "保存済み" : "保存する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
