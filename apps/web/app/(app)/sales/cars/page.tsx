"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  getSalesSummary,
  getSalesMonthly,
  getSalesByCar,
  getSalesByStaff,
  getInventoryStats,
  type SalesSummary,
  type SalesMonthlyRow,
  type SalesByCarRow,
  type SalesByStaffRow,
  type InventoryStats,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Car, Users, PackageOpen } from "lucide-react";

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatJPY(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "―";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return "―";
  return `${(r * 100).toFixed(1)}%`;
}

function formatM(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

// ─── MoM Trend Badge ────────────────────────────────────────────────────────

function MomBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const diff = ((current - prev) / Math.abs(prev)) * 100;
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-500">
        <Minus className="h-3 w-3" /> 前月比同等
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-semibold">
        <TrendingUp className="h-3 w-3" /> +{diff.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-semibold">
      <TrendingDown className="h-3 w-3" /> {diff.toFixed(1)}%
    </span>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  mom,
  sub,
}: {
  title: string;
  value: string;
  mom?: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-0.5">
        {mom}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-white shadow-md px-4 py-3 text-xs space-y-1">
      <p className="font-semibold">{label}月</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatJPY(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SalesCarsPage() {
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1);

  const [summary, setSummary] = React.useState<SalesSummary | null>(null);
  const [monthly, setMonthly] = React.useState<SalesMonthlyRow[]>([]);
  const [byCar, setByCar] = React.useState<SalesByCarRow[]>([]);
  const [byStaff, setByStaff] = React.useState<SalesByStaffRow[]>([]);
  const [invStats, setInvStats] = React.useState<InventoryStats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [sortKey, setSortKey] = React.useState<"profit" | "profit_rate" | "sell_price">("profit");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, mon, cars, staff, inv] = await Promise.all([
        getSalesSummary(year, month),
        getSalesMonthly(year),
        getSalesByCar(year, month),
        getSalesByStaff(year, month),
        getInventoryStats(),
      ]);
      setSummary(sum);
      setMonthly(mon.rows);
      setByCar(cars.rows);
      setByStaff(staff.rows);
      setInvStats(inv);
    } catch (e: any) {
      setError(e?.message ?? "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartData = monthly.map((r) => ({
    name: `${r.month}`,
    sales: r.sales,
    profit: r.profit,
    count: r.count,
  }));

  const sortedCars = React.useMemo(() => {
    return [...byCar].sort((a, b) => {
      const av = (a[sortKey] ?? 0) as number;
      const bv = (b[sortKey] ?? 0) as number;
      return bv - av;
    });
  }, [byCar, sortKey]);

  const th = summary?.this_month;
  const prev = summary?.prev_month;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">車両売上・利益管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            車両販売実績（ステータス変更日を売却日として集計）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="h-9 px-4 rounded-md bg-black text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "読込中…" : "更新"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title={`${month}月 売上台数`}
          value={`${th?.count ?? 0} 台`}
          mom={th && prev ? <MomBadge current={th.count} prev={prev.count} /> : undefined}
          sub={`前月: ${prev?.count ?? 0} 台`}
        />
        <KpiCard
          title={`${month}月 売上合計`}
          value={formatJPY(th?.sales ?? 0)}
          mom={th && prev ? <MomBadge current={th.sales} prev={prev.sales} /> : undefined}
          sub={`前月: ${formatJPY(prev?.sales ?? 0)}`}
        />
        <KpiCard
          title={`${month}月 粗利合計`}
          value={formatJPY(th?.profit ?? 0)}
          mom={th && prev ? <MomBadge current={th.profit} prev={prev.profit} /> : undefined}
          sub={`前月: ${formatJPY(prev?.profit ?? 0)}`}
        />
        <KpiCard
          title={`${month}月 粗利率`}
          value={formatPct(th?.profit_rate ?? 0)}
          sub={`前月: ${formatPct(prev?.profit_rate ?? 0)}`}
        />
      </div>

      {/* ─── Inventory Stats ─── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50">
                <PackageOpen className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardDescription>現在の在庫</CardDescription>
                <CardTitle className="text-xl">{invStats?.total_count ?? 0} 台</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            仕入れ総額: {formatJPY(invStats?.total_cost ?? 0)}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50">
                <Car className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardDescription>商談中</CardDescription>
                <CardTitle className="text-xl">{invStats?.negotiating_count ?? 0} 台</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            成約待ちの車両
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardDescription>スタッフ数（当月実績）</CardDescription>
                <CardTitle className="text-xl">{byStaff.length} 名</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            当月に売上を記録したスタッフ
          </CardContent>
        </Card>
      </div>

      {/* ─── Monthly Bar Chart ─── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{year}年 月別売上・粗利</CardTitle>
          <CardDescription>棒グラフ: 売上（青）/ 粗利（緑）</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tickFormatter={(v) => `${v}月`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tickFormatter={(v) => formatM(Number(v))} tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="sales" name="売上" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="profit" name="粗利" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              データがありません
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Car-level Table ─── */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">{year}年{month}月 車両別実績</CardTitle>
              <CardDescription>売却済み車両（在庫・商談中以外）の一覧</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">並び替え:</span>
              {(["profit", "profit_rate", "sell_price"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  className={[
                    "px-2 py-1 rounded border text-xs font-medium",
                    sortKey === k ? "bg-black text-white border-black" : "bg-white border-slate-200",
                  ].join(" ")}
                >
                  {k === "profit" ? "粗利" : k === "profit_rate" ? "粗利率" : "売上"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold">管理番号</th>
                  <th className="px-3 py-2 font-semibold">メーカー・車種</th>
                  <th className="px-3 py-2 font-semibold">ステータス</th>
                  <th className="px-3 py-2 text-right font-semibold">仕入額</th>
                  <th className="px-3 py-2 text-right font-semibold">販売額</th>
                  <th className="px-3 py-2 text-right font-semibold">粗利</th>
                  <th className="px-3 py-2 text-right font-semibold">粗利率</th>
                  <th className="px-3 py-2 font-semibold">担当</th>
                  <th className="px-3 py-2 font-semibold">売却日</th>
                </tr>
              </thead>
              <tbody>
                {sortedCars.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      {loading ? "読込中…" : "データがありません"}
                    </td>
                  </tr>
                ) : (
                  sortedCars.map((car, idx) => (
                    <tr
                      key={car.car_id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                    >
                      <td className="px-3 py-2 font-mono">{car.stock_no}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{car.make} {car.model}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{car.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatJPY(car.buy_price)}</td>
                      <td className="px-3 py-2 text-right">{formatJPY(car.sell_price)}</td>
                      <td className={[
                        "px-3 py-2 text-right font-semibold",
                        (car.profit ?? 0) >= 0 ? "text-emerald-600" : "text-red-500",
                      ].join(" ")}>
                        {formatJPY(car.profit)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatPct(car.profit_rate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{car.staff_name ?? "―"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{car.sold_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Staff Table ─── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{year}年{month}月 スタッフ別実績</CardTitle>
          <CardDescription>担当者ごとの売上・粗利集計</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold">スタッフ名</th>
                  <th className="px-3 py-2 text-right font-semibold">台数</th>
                  <th className="px-3 py-2 text-right font-semibold">売上合計</th>
                  <th className="px-3 py-2 text-right font-semibold">粗利合計</th>
                  <th className="px-3 py-2 text-right font-semibold">平均粗利率</th>
                </tr>
              </thead>
              <tbody>
                {byStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      {loading ? "読込中…" : "データがありません"}
                    </td>
                  </tr>
                ) : (
                  byStaff.map((s, idx) => (
                    <tr key={s.user_id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                      <td className="px-3 py-2 font-medium">{s.staff_name}</td>
                      <td className="px-3 py-2 text-right">{s.count} 台</td>
                      <td className="px-3 py-2 text-right">{formatJPY(s.total_sales)}</td>
                      <td className={[
                        "px-3 py-2 text-right font-semibold",
                        s.total_profit >= 0 ? "text-emerald-600" : "text-red-500",
                      ].join(" ")}>
                        {formatJPY(s.total_profit)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatPct(s.avg_profit_rate)}</td>
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
