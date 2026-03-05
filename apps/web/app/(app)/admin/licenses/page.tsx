"use client";

import * as React from "react";
import Link from "next/link";
import {
  listLicenses,
  updateLicense,
  suspendLicense,
  type License,
  type LicensePlan,
  type LicenseStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, RefreshCw, Pencil, Ban } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "―";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return iso;
  }
}

const PLAN_LABELS: Record<LicensePlan, string> = {
  starter: "スタート",
  standard: "スタンダード",
  pro: "プロ",
};

const STATUS_CONFIG: Record<
  LicenseStatus,
  { label: string; className: string }
> = {
  trial: {
    label: "試用中",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  active: {
    label: "有効",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  expired: {
    label: "期限切れ",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  suspended: {
    label: "停止",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

function StatusBadge({ status }: { status: LicenseStatus }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────

function EditDialog({
  license,
  onClose,
  onSaved,
}: {
  license: License;
  onClose: () => void;
  onSaved: (updated: License) => void;
}) {
  const [plan, setPlan] = React.useState<LicensePlan>(license.plan);
  const [licStatus, setLicStatus] = React.useState<LicenseStatus>(license.status);
  const [periodEnd, setPeriodEnd] = React.useState(
    license.current_period_end ? license.current_period_end.substring(0, 10) : ""
  );
  const [notes, setNotes] = React.useState(license.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateLicense(license.id, {
        plan,
        status: licStatus,
        current_period_end: periodEnd ? `${periodEnd}T23:59:59Z` : undefined,
        notes: notes || undefined,
      });
      onSaved(updated);
    } catch (e: any) {
      setError(e?.message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border bg-white shadow-xl p-6 space-y-5 mx-4">
        <h2 className="text-lg font-bold">ライセンス編集 — {license.store_name}</h2>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">プラン</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as LicensePlan)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
            >
              {(["starter", "standard", "pro"] as const).map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">ステータス</label>
            <select
              value={licStatus}
              onChange={(e) => setLicStatus(e.target.value as LicenseStatus)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
            >
              <option value="trial">試用中</option>
              <option value="active">有効</option>
              <option value="expired">期限切れ</option>
              <option value="suspended">停止</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">次回更新日</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">メモ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminLicensesPage() {
  const [licenses, setLicenses] = React.useState<License[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<License | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<"all" | LicenseStatus>("all");
  const [search, setSearch] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLicenses();
      setLicenses(data);
    } catch (e: any) {
      setError(e?.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSuspend(lic: License) {
    if (!confirm(`「${lic.store_name}」のライセンスを停止しますか？`)) return;
    try {
      await suspendLicense(lic.id);
      setLicenses((prev) =>
        prev.map((l) => (l.id === lic.id ? { ...l, status: "suspended" } : l))
      );
    } catch (e: any) {
      alert(e?.message ?? "停止に失敗しました");
    }
  }

  const filtered = licenses.filter((l) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (search && !l.store_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<string, number> = { all: licenses.length };
  for (const l of licenses) {
    counts[l.status] = (counts[l.status] ?? 0) + 1;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {editing && (
        <EditDialog
          license={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setLicenses((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
            setEditing(null);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">契約店舗一覧</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ライセンスの発行・編集・停止を管理します（superadmin 専用）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            更新
          </Button>
          <Link href="/admin/licenses/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              ライセンス発行
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["all", "trial", "active", "expired", "suspended"] as const)
          .filter((k) => k === "all" || counts[k])
          .map((k) => (
            <button
              key={k}
              onClick={() => setFilterStatus(k)}
              className={[
                "rounded-xl border p-3 text-left transition-all",
                filterStatus === k
                  ? "border-black bg-black text-white"
                  : "border-slate-200 bg-white hover:border-slate-300",
              ].join(" ")}
            >
              <div className="text-xs font-medium opacity-70">
                {k === "all" ? "全て" : STATUS_CONFIG[k as LicenseStatus]?.label ?? k}
              </div>
              <div className="text-2xl font-bold">{counts[k] ?? 0}</div>
            </button>
          ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="店舗名で検索…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm shadow-sm"
      />

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">ライセンス一覧 ({filtered.length} 件)</CardTitle>
          <CardDescription>在庫クリックで編集ダイアログを開く</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold">店舗名</th>
                  <th className="px-3 py-2 font-semibold">プラン</th>
                  <th className="px-3 py-2 font-semibold">ステータス</th>
                  <th className="px-3 py-2 font-semibold">試用期限</th>
                  <th className="px-3 py-2 font-semibold">次回更新日</th>
                  <th className="px-3 py-2 font-semibold">発行日</th>
                  <th className="px-3 py-2 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      {loading ? "読込中…" : "データがありません"}
                    </td>
                  </tr>
                ) : (
                  filtered.map((lic, idx) => (
                    <tr
                      key={lic.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      <td className="px-3 py-2.5 font-semibold">{lic.store_name}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px]">
                          {PLAN_LABELS[lic.plan] ?? lic.plan}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={lic.status} />
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {fmtDate(lic.trial_ends_at)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {fmtDate(lic.current_period_end)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        {fmtDate(lic.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditing(lic)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            <Pencil className="h-3 w-3" /> 編集
                          </button>
                          {lic.status !== "suspended" && (
                            <button
                              onClick={() => handleSuspend(lic)}
                              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                            >
                              <Ban className="h-3 w-3" /> 停止
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
