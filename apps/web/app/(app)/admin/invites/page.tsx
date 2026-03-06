"use client";

import * as React from "react";
import { Link2, Copy, Trash2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── 型 ──────────────────────────────────────────────────────

type AdminInvite = {
  id: string;
  store_id: string;
  store_name: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
};

// ─── ユーティリティ ──────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "無期限";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function isExpired(invite: AdminInvite): boolean {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at) < new Date();
}

function isExhausted(invite: AdminInvite): boolean {
  return invite.used_count >= invite.max_uses;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "管理者",
  manager: "マネージャー",
  staff: "スタッフ",
};

// ─── メインページ ────────────────────────────────────────────

export default function AdminInvitesPage() {
  const [invites, setInvites] = React.useState<AdminInvite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AdminInvite[]>("/api/v1/admin/invites");
      setInvites(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return invites;
    return invites.filter(
      (inv) =>
        inv.store_name.toLowerCase().includes(q) ||
        inv.code.toLowerCase().includes(q) ||
        inv.role.includes(q)
    );
  }, [invites, search]);

  const deleteInvite = async (inv: AdminInvite) => {
    if (!window.confirm(`招待コード「${inv.code}」（${inv.store_name}）を削除しますか？`)) return;
    try {
      await apiFetch<void>(`/api/v1/admin/invites/${inv.id}`, { method: "DELETE" });
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除失敗");
    }
  };

  const copyCode = (code: string) => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Link2 className="h-5 w-5" />
        紹介管理（全店舗）
      </div>
      <div className="text-sm text-muted-foreground">
        全店舗の招待コードを一覧表示します。コードのコピー・削除が可能です。
      </div>

      {/* フィルタ */}
      <div className="flex gap-3 items-center">
        <Input
          placeholder="店舗名・コードで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="secondary" size="sm" onClick={load}>
          <RefreshCw size={13} className="mr-1" />
          再読込
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} 件</span>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <div className="rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店舗名</TableHead>
                <TableHead className="w-[140px]">招待コード</TableHead>
                <TableHead className="w-[90px]">ロール</TableHead>
                <TableHead className="w-[80px]">使用回数</TableHead>
                <TableHead className="w-[110px]">有効期限</TableHead>
                <TableHead className="w-[110px]">作成日</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    招待コードがありません
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((inv) => {
                const expired = isExpired(inv);
                const exhausted = isExhausted(inv);
                const invalid = expired || exhausted;
                return (
                  <TableRow key={inv.id} style={{ opacity: invalid ? 0.5 : 1 }}>
                    <TableCell style={{ fontSize: 13 }}>{inv.store_name}</TableCell>
                    <TableCell>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <code style={{ fontSize: 12, fontFamily: "monospace", color: "#e0e0e0" }}>
                          {inv.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(inv.code)}
                          style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            color: copied === inv.code ? "#10b981" : "#888", padding: 2,
                          }}
                          title="コピー"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#aaa", background: "#3a3a3a", padding: "2px 7px", borderRadius: 5 }}>
                        {ROLE_LABEL[inv.role] ?? inv.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          fontSize: 12,
                          color: exhausted ? "#ef4444" : "#aaa",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {inv.used_count}/{inv.max_uses}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span style={{ fontSize: 12, color: expired ? "#ef4444" : "#aaa" }}>
                        {fmtDate(inv.expires_at)}
                        {expired && " (期限切れ)"}
                      </span>
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "#666" }}>
                      {fmtDate(inv.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => deleteInvite(inv)}
                        style={{
                          background: "transparent", border: "none", cursor: "pointer",
                          color: "#ef4444", padding: 4,
                        }}
                        title="削除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
