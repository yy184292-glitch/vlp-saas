"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createInvite, getMe, getSeats, listInvites, ApiError } from "@/lib/api";

type Invite = {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  created_at: string;
  expires_at?: string | null;
};

export default function StaffPage() {
  const router = useRouter();

  const [role, setRole] = useState<string>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seats, setSeats] = useState<{ plan_code: string; seat_limit: number; active_users: number } | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);

  const [inviteRole, setInviteRole] = useState<string>("staff");
  const [maxUses, setMaxUses] = useState<number>(1);

  const canManage = useMemo(() => role === "admin" || role === "manager", [role]);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const me = await getMe();
      setRole(me.role);

      if (!(me.role === "admin" || me.role === "manager")) {
        router.replace("/dashboard");
        return;
      }

      const s = await getSeats();
      setSeats({ plan_code: s.plan_code, seat_limit: s.seat_limit, active_users: s.active_users });

      const list = await listInvites();
      setInvites(list as any);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateInvite() {
    setError(null);
    setBusy(true);
    try {
      await createInvite({ role: inviteRole, max_uses: maxUses, code_length: 10 });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError("権限がありません");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>スタッフ管理（招待コード）</h1>

      {error ? (
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* 席数 */}
      <div
        style={{
          border: "2px solid #e5e7eb",
          background: "#fff",
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>契約プラン / 席数</div>
        {seats ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>プラン: <b>{seats.plan_code}</b></div>
            <div>利用中: <b>{seats.active_users}</b> / <b>{seats.seat_limit}</b></div>
            <div style={{ color: "#666", fontSize: 12 }}>
              ※ 端末数ではなく「ユーザー数（アカウント数）」でカウントします
            </div>
          </div>
        ) : (
          <div style={{ color: "#666" }}>読み込み中...</div>
        )}
      </div>

      {/* 招待作成 */}
      <div
        style={{
          border: "2px solid #e5e7eb",
          background: "#fff",
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>招待コードを発行</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#666" }}>ロール</span>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={busy}
              style={{ padding: "10px 12px", borderRadius: 12, border: "2px solid #e5e7eb", fontWeight: 800 }}
            >
              <option value="staff">staff（売上NG）</option>
              <option value="manager">manager（売上OK）</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#666" }}>使用回数</span>
            <input
              type="number"
              value={maxUses}
              min={1}
              max={10}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              disabled={busy}
              style={{ padding: "10px 12px", borderRadius: 12, border: "2px solid #e5e7eb", width: 120, fontWeight: 800 }}
            />
          </label>

          <button
            onClick={onCreateInvite}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
              height: 44,
              marginTop: 18,
            }}
          >
            {busy ? "発行中..." : "発行"}
          </button>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
          スタッフには <b>/register</b> を開かせて、招待コードを入力して登録させてください。
        </div>
      </div>

      {/* 招待一覧 */}
      <div
        style={{
          border: "2px solid #e5e7eb",
          background: "#fff",
          borderRadius: 16,
          padding: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>招待コード一覧</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "#666" }}>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>コード</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>ロール</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>使用</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>期限</th>
                <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>作成日</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "#666" }}>
                    招待コードはまだありません
                  </td>
                </tr>
              ) : (
                invites.map((x) => (
                  <tr key={x.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", fontWeight: 900, letterSpacing: 1 }}>
                      {x.code}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{x.role}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {x.used_count} / {x.max_uses}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{x.expires_at ?? "-"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {new Date(x.created_at).toLocaleString()}
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
