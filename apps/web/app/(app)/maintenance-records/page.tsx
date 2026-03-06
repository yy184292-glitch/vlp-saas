"use client";

import * as React from "react";
import Link from "next/link";
import { listWorkReports, type WorkReport } from "@/lib/api/workReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ClipboardList, ExternalLink, Search, Wrench, Package } from "lucide-react";

// ─── ユーティリティ ──────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function totalAmount(report: WorkReport): number {
  return report.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
}

function workSummary(report: WorkReport): string {
  const works = report.items.filter((i) => i.item_type === "work").map((i) => i.item_name);
  if (works.length === 0) return "-";
  if (works.length <= 3) return works.join("、");
  return works.slice(0, 3).join("、") + ` 他${works.length - 3}件`;
}

// ─── メインページ ────────────────────────────────────────────────

export default function MaintenanceRecordsPage() {
  const [reports, setReports] = React.useState<WorkReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listWorkReports({ status: "completed" });
        // 完了日の新しい順
        data.sort((a, b) => {
          const da = a.completed_at ?? a.updated_at;
          const db = b.completed_at ?? b.updated_at;
          return db.localeCompare(da);
        });
        setReports(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 検索フィルタ（タイトル・担当者・作業内容）
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const haystack = [
        r.title ?? "",
        r.reported_by ?? "",
        r.vehicle_category ?? "",
        ...r.items.map((i) => i.item_name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [reports, search]);

  // 月別グルーピング
  const grouped = React.useMemo(() => {
    const map = new Map<string, WorkReport[]>();
    for (const r of filtered) {
      const key = fmtMonth(r.completed_at ?? r.updated_at);
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ClipboardList className="h-5 w-5" />
            整備記録簿
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            完了済みの作業報告書を整備記録として一覧表示します。
          </div>
        </div>
        <div className="text-sm text-muted-foreground tabular-nums">
          全 {filtered.length} 件
        </div>
      </div>

      {/* 検索バー */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="タイトル・担当者・作業内容で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Separator />

      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {search ? "検索結果がありません。" : "完了済みの作業報告書がありません。"}
        </div>
      )}

      {/* 月別リスト */}
      {Array.from(grouped.entries()).map(([month, monthReports]) => (
        <div key={month} className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground px-1">{month}</div>
          <div className="grid gap-2">
            {monthReports.map((report) => {
              const workCount = report.items.filter((i) => i.item_type === "work").length;
              const materialCount = report.items.filter((i) => i.item_type === "material").length;
              const amount = totalAmount(report);

              return (
                <Card key={report.id} className="shadow-sm hover:bg-muted/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* タイトル行 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">
                            {report.title ?? "（タイトルなし）"}
                          </span>
                          {report.vehicle_category && (
                            <Badge variant="secondary" className="text-xs">
                              {report.vehicle_category}
                            </Badge>
                          )}
                        </div>

                        {/* 完了日・担当者 */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                          <span>完了日：{fmtDate(report.completed_at)}</span>
                          {report.reported_by && (
                            <span>担当者：{report.reported_by}</span>
                          )}
                        </div>

                        {/* 作業内容サマリー */}
                        <div className="text-sm text-muted-foreground">
                          {workSummary(report)}
                        </div>

                        {/* 件数バッジ */}
                        <div className="flex items-center gap-3 text-xs">
                          {workCount > 0 && (
                            <span className="flex items-center gap-1 text-sky-400">
                              <Wrench className="h-3 w-3" />
                              作業 {workCount} 件
                            </span>
                          )}
                          {materialCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Package className="h-3 w-3" />
                              部材 {materialCount} 件
                            </span>
                          )}
                          {amount > 0 && (
                            <span className="text-muted-foreground">
                              合計 ¥{amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 詳細リンク */}
                      {report.instruction_id && (
                        <Link
                          href={`/work-orders/${report.instruction_id}/report`}
                          className="shrink-0 flex items-center gap-1 text-xs text-sky-400 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          詳細
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
