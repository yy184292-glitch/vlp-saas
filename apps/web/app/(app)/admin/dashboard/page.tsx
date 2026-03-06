"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, CheckCircle, Clock, XCircle, AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── 型 ──────────────────────────────────────────────────────

type DashboardStats = {
  total_stores: number;
  total_users: number;
  licenses_active: number;
  licenses_trial: number;
  licenses_suspended: number;
  licenses_expiring_soon: number;
};

// ─── 統計カード ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color, fontVariantNumeric: "tabular-nums" }}>
              {value.toLocaleString()}
            </div>
            {sub && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{sub}</div>}
          </div>
          <div style={{ color, opacity: 0.7 }}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── クイックリンク ──────────────────────────────────────────

const QUICK_LINKS = [
  { href: "/admin/licenses", label: "ライセンス管理", desc: "店舗ライセンスの発行・編集・延長" },
  { href: "/admin/invites", label: "紹介管理", desc: "全店舗の招待コード一覧" },
  { href: "/admin/licenses/new", label: "新規ライセンス発行", desc: "新しい店舗を追加する" },
];

// ─── メインページ ────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<DashboardStats>("/api/v1/admin/dashboard");
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <LayoutDashboard className="h-5 w-5" />
        管理ダッシュボード
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}

      {/* 統計グリッド */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="総店舗数"
            value={stats.total_stores}
            icon={<Building2 size={28} />}
            color="#3b82f6"
          />
          <StatCard
            label="総ユーザー数"
            value={stats.total_users}
            icon={<Users size={28} />}
            color="#8b5cf6"
          />
          <StatCard
            label="アクティブライセンス"
            value={stats.licenses_active}
            icon={<CheckCircle size={28} />}
            color="#10b981"
          />
          <StatCard
            label="トライアル中"
            value={stats.licenses_trial}
            icon={<Clock size={28} />}
            color="#f59e0b"
          />
          <StatCard
            label="停止中"
            value={stats.licenses_suspended}
            icon={<XCircle size={28} />}
            color="#ef4444"
          />
          <StatCard
            label="30日以内に期限切れ"
            value={stats.licenses_expiring_soon}
            icon={<AlertTriangle size={28} />}
            color={stats.licenses_expiring_soon > 0 ? "#f59e0b" : "#555"}
            sub={stats.licenses_expiring_soon > 0 ? "要対応" : "問題なし"}
          />
        </div>
      )}

      {/* クイックリンク */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-muted-foreground">クイックリンク</div>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="border-border/60 shadow-sm hover:bg-muted/20 transition-colors cursor-pointer">
                <CardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{link.label}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{link.desc}</div>
                    </div>
                    <ArrowRight size={14} color="#555" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
