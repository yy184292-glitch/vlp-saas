"use client";

import * as React from "react";
import {
  listLineCustomers,
  listLineMessages,
  sendLineMessage,
  broadcastLineMessage,
  linkLineCustomer,
  type LineCustomer,
  type LineMessage,
} from "@/lib/api";
import { Send, Users, MessageCircle, Radio, Link2, UserPlus, RefreshCw } from "lucide-react";

type Tab = "customers" | "messages" | "broadcast";

const STATUS_LABELS: Record<string, string> = { following: "フォロー中", blocked: "ブロック", unknown: "不明" };
const STATUS_COLORS: Record<string, string> = { following: "#10b981", blocked: "#6b7280", unknown: "#f59e0b" };

function fmtDate(s: string | null | undefined) {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function LinePage() {
  const [tab, setTab] = React.useState<Tab>("customers");
  const [customers, setCustomers] = React.useState<LineCustomer[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setCustomers(await listLineCustomers());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "9px 16px",
    borderRadius: 10,
    border: "none",
    background: tab === t ? "#3a3a3a" : "transparent",
    color: tab === t ? "#fff" : "#888",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MessageCircle size={22} color="#06b6d4" />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>LINE管理</h1>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#2a2a2a", borderRadius: 12, padding: 4 }}>
        <button style={tabStyle("customers")} onClick={() => setTab("customers")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Users size={14} />友だち一覧</span>
        </button>
        <button style={tabStyle("messages")} onClick={() => setTab("messages")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MessageCircle size={14} />メッセージ</span>
        </button>
        <button style={tabStyle("broadcast")} onClick={() => setTab("broadcast")}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Radio size={14} />一斉送信</span>
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#666", fontSize: 14 }}>読込中…</div>
      ) : (
        <>
          {tab === "customers" && <CustomersTab customers={customers} onRefresh={load} />}
          {tab === "messages" && <MessagesTab customers={customers} />}
          {tab === "broadcast" && <BroadcastTab />}
        </>
      )}
    </div>
  );
}

// ─── タブ1: 友だち一覧 ────────────────────────────────────────────

function CustomersTab({ customers, onRefresh }: { customers: LineCustomer[]; onRefresh: () => void }) {
  const [linkingId, setLinkingId] = React.useState<string | null>(null);

  return (
    <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#1e1e1e", borderBottom: "1px solid #3a3a3a" }}>
            {["アイコン", "名前", "紐付け顧客", "状態", "操作"].map(h => (
              <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#aaa" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#666" }}>LINE友だちがいません</td></tr>
          ) : customers.map((c, i) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #333", background: i % 2 === 0 ? "transparent" : "#ffffff06" }}>
              <td style={{ padding: "10px 12px" }}>
                {c.picture_url ? (
                  <img src={c.picture_url} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#3a3a3a", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 16 }}>👤</div>
                )}
              </td>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                {c.display_name ?? "名前なし"}
                <div style={{ fontSize: 11, color: "#666", marginTop: 2, fontFamily: "monospace" }}>{c.line_user_id.slice(0, 16)}…</div>
              </td>
              <td style={{ padding: "10px 12px", color: c.customer_id ? "#93c5fd" : "#555" }}>
                {c.customer_id ? "紐付け済み" : "未紐付け"}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: (STATUS_COLORS[c.follow_status] ?? "#888") + "22", color: STATUS_COLORS[c.follow_status] ?? "#888" }}>
                  {STATUS_LABELS[c.follow_status] ?? c.follow_status}
                </span>
              </td>
              <td style={{ padding: "10px 12px" }}>
                {c.customer_id ? (
                  <button
                    onClick={async () => { await linkLineCustomer(c.id, null); onRefresh(); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1px solid #3a3a3a", background: "transparent", color: "#888", fontSize: 11, cursor: "pointer" }}
                  >
                    <Link2 size={11} /> 紐付け解除
                  </button>
                ) : (
                  <button
                    onClick={() => setLinkingId(linkingId === c.id ? null : c.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "none", background: "#3b82f6", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                  >
                    <UserPlus size={11} /> 顧客紐付け
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── タブ2: メッセージ ────────────────────────────────────────────

function MessagesTab({ customers }: { customers: LineCustomer[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(customers[0]?.id ?? null);
  const [messages, setMessages] = React.useState<LineMessage[]>([]);
  const [msgLoading, setMsgLoading] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!selectedId) return;
    setMsgLoading(true);
    listLineMessages(selectedId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  }, [selectedId]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!text.trim() || !selectedId) return;
    setSending(true);
    try {
      await sendLineMessage({ line_customer_id: selectedId, message: text.trim() });
      setText("");
      const updated = await listLineMessages(selectedId);
      setMessages(updated);
    } catch { alert("送信に失敗しました"); }
    finally { setSending(false); }
  }

  const selected = customers.find(c => c.id === selectedId);

  return (
    <div style={{ display: "flex", gap: 12, height: 560 }}>
      {/* 友だちリスト */}
      <div style={{ width: 220, background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, overflowY: "auto", flexShrink: 0 }}>
        {customers.map(c => (
          <div
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", background: selectedId === c.id ? "#3a3a3a" : "transparent", borderBottom: "1px solid #333" }}
          >
            {c.picture_url ? (
              <img src={c.picture_url} alt="" width={30} height={30} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#3a3a3a", flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.display_name ?? "名前なし"}
            </span>
          </div>
        ))}
        {customers.length === 0 && <div style={{ padding: 16, color: "#666", fontSize: 12 }}>友だちがいません</div>}
      </div>

      {/* チャット */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 12, overflow: "hidden" }}>
        {/* ヘッダー */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #3a3a3a", fontWeight: 700, fontSize: 14 }}>
          {selected ? (selected.display_name ?? "名前なし") : "友だちを選択"}
        </div>

        {/* メッセージ一覧 */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {msgLoading ? (
            <div style={{ color: "#666", fontSize: 13 }}>読込中…</div>
          ) : messages.length === 0 ? (
            <div style={{ color: "#666", fontSize: 13 }}>メッセージがありません</div>
          ) : messages.map(m => (
            <div key={m.id} style={{ display: "flex", justifyContent: m.direction === "outbound" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "70%",
                background: m.direction === "outbound" ? "#3b82f6" : "#3a3a3a",
                color: "#fff",
                borderRadius: m.direction === "outbound" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "9px 13px",
                fontSize: 13,
              }}>
                <div>{m.content ?? `[${m.message_type}]`}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 3, textAlign: "right" }}>{fmtDate(m.sent_at)}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 送信フォーム */}
        <div style={{ padding: 12, borderTop: "1px solid #3a3a3a", display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            placeholder="メッセージを入力…"
            disabled={!selectedId}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #3a3a3a", background: "#1e1e1e", color: "#e0e0e0", fontSize: 13 }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !selectedId || sending}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            <Send size={14} />
            送信
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── タブ3: 一斉送信 ────────────────────────────────────────────

function BroadcastTab() {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleBroadcast() {
    if (!message.trim()) return;
    if (!confirm("全ての友だちにメッセージを送信しますか？")) return;
    setSending(true);
    try {
      await broadcastLineMessage(message.trim());
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch { alert("送信に失敗しました"); }
    finally { setSending(false); }
  }

  return (
    <div style={{ maxWidth: 560, background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <Radio size={16} color="#06b6d4" />
        全友だちへ一斉送信
      </div>
      <div style={{ fontSize: 12, color: "#f59e0b", background: "#f59e0b11", border: "1px solid #f59e0b33", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
        ⚠ 全ての友だちに送信されます。内容を十分確認してから送信してください。
      </div>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="送信するメッセージを入力…"
        rows={5}
        style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #3a3a3a", background: "#1e1e1e", color: "#e0e0e0", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
      />
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleBroadcast}
          disabled={!message.trim() || sending}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 10, border: "none", background: sent ? "#10b981" : "#06b6d4", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          <Send size={15} />
          {sending ? "送信中…" : sent ? "送信済み！" : "一斉送信する"}
        </button>
      </div>
    </div>
  );
}
