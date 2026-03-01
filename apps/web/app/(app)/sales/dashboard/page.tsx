"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// ✅ api.ts の関数を使う（URL/認証/クエリずれ事故を防ぐ）
import {
  getDashboardSummary,
  getProfitDaily,
  type DashboardSummary,
  type SalesMode,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts";

type ProfitDailyViewRow = {
  date: string; // YYYY-MM-DD (UI用)
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number; // UI用に算出
};

const LS_STORE_ID = "vlp_store_id";
const LS_SALES_MODE = "vlp_sales_mode";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function formatJPY(n: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function formatPct(r: number): string {
  const v = Number.isFinite(r) ? r : 0;
  return `${(v * 100).toFixed(1)}%`;
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toISODate(d);
}

function clampDateRange(start: string, end: string): { start: string; end: string } {
  if (!start || !end) return { start, end };
  return start <= end ? { start, end } : { start: end, end: start };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const escape = (v: unknown) => {
    const raw = v === null || v === undefined ? "" : String(v);
    // CSV Injection 対策（Excel等）
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    const needsQuote = /[",\n]/.test(safe);
    const body = safe.replace(/"/g, '""');
    return needsQuote ? `"${body}"` : body;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SalesTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/sales/dashboard", label: "ダッシュボード" },
    { href: "/sales/monthly", label: "月次" },
    { href: "/sales/daily", label: "日次" },
    { href: "/sales/by-work", label: "作業別" },
    { href: "/sales/cost-by-item", label: "部材別原価" },
  ];

  const current =
    tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? "/sales/dashboard";

  return (
    <Tabs value={current}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.href} value={t.href} asChild>
            <Link href={t.href}>{t.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function KpiCard({
  title,
  value,
  sub,
  tone = "default",
}: {
  title: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center justify-between">
          <span>{title}</span>
          {tone === "good" ? <Badge>良</Badge> : null}
          {tone === "bad" ? <Badge variant="destructive">注意</Badge> : null}
        </CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      {sub ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{sub}</CardContent>
      ) : (
        <CardContent className="pt-0" />
      )}
    </Card>
  );
}

export default function SalesDashboardPage() {
  const router = useRouter();

  const today = React.useMemo(() => toISODate(new Date()), []);
  const [preset, setPreset] = React.useState<"7" | "30" | "90" | "custom">("30");

  const [storeId, setStoreId] = React.useState<number>(1);
  const [salesMode, setSalesMode] = React.useState<SalesMode>("exclusive");

  const [startDate, setStartDate] = React.useState<string>(addDays(today, -29));
  const [endDate, setEndDate] = React.useState<string>(today);

  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [daily, setDaily] = React.useState<ProfitDailyViewRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  // 互換性のためにAbortControllerを保持（api.tsがsignalを受け取らない場合もある）
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    try {
      const s = localStorage.getItem(LS_STORE_ID);
      const m = localStorage.getItem(LS_SALES_MODE) as SalesMode | null;
      if (s) setStoreId(Math.max(1, Number(s) || 1));
      if (m === "exclusive" || m === "inclusive") setSalesMode(m);
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_STORE_ID, String(storeId));
      localStorage.setItem(LS_SALES_MODE, salesMode);
    } catch {}
  }, [storeId, salesMode]);

  React.useEffect(() => {
    if (preset === "custom") return;
    const days = Number(preset);
    setStartDate(addDays(today, -(days - 1)));
    setEndDate(today);
  }, [preset, today]);

  const range = React.useMemo(() => clampDateRange(startDate, endDate), [startDate, endDate]);

  const chartConfig = React.useMemo<ChartConfig>(
    () => ({
      sales: { label: "売上" },
      cost: { label: "原価" },
      profit: { label: "粗利" },
      margin_rate: { label: "粗利率" },
    }),
    []
  );

  async function fetchAll() {
    setLoading(true);
    setError("");

    // 先行リクエストを中断（api.tsがsignal未対応でも副作用なし）
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // ✅ api.ts 前提の引数名（date_from/date_to）
      const args = {
        date_from: range.start,
        date_to: range.end,
        store_id: String(storeId),
        sales_mode: salesMode,
      } as const;

      const [sumRes, dailyRes] = await Promise.all([
        getDashboardSummary(args),
        getProfitDaily(args),
      ]);

      // ✅ api.ts の daily row は day なので UI用に date へ変換
      const rows: ProfitDailyViewRow[] = (dailyRes?.rows ?? []).map((r: any) => {
        const sales = safeNumber(r.sales);
        const profit = safeNumber(r.profit);
        return {
          date: String(r.day ?? r.date ?? ""),
          sales,
          cost: safeNumber(r.cost),
          profit,
          // margin_rate は daily に無い場合があるので算出
          margin_rate: Number.isFinite(r.margin_rate) ? safeNumber(r.margin_rate) : sales ? profit / sales : 0,
        };
      });

      rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      setSummary(sumRes ?? null);
      setDaily(rows);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ? String(e.message) : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, salesMode, range.start, range.end]);

  const kpi = React.useMemo(() => {
    const s = summary?.sales ?? 0;
    const c = summary?.cost ?? 0;
    const p = summary?.profit ?? 0;
    // summary.margin_rate が無い/NaN の場合に備えて算出
    const mr = Number.isFinite(summary?.margin_rate) ? (summary?.margin_rate ?? 0) : s ? p / s : 0;
    return { s, c, p, mr };
  }, [summary]);

  const onExport = () => {
    const rows = daily.map((r) => ({
      date: r.date,
      sales: r.sales,
      cost: r.cost,
      profit: r.profit,
      margin_rate: r.margin_rate,
    }));
    downloadCSV(`sales_dashboard_daily_store-${storeId}_${salesMode}_${range.start}_${range.end}.csv`, rows);
  };

  const onClickDay = (date: string) => {
    const q = buildQuery({ date, store_id: storeId, sales_mode: salesMode });
    router.push(`/sales/daily${q}`);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xl font-semibold tracking-tight">売上レポート</div>
            <div className="text-sm text-muted-foreground">
              store_id={storeId} / {salesMode} / {range.start} - {range.end}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onExport} disabled={daily.length === 0}>
              CSV（期間日次）
            </Button>
            <Button onClick={fetchAll} disabled={loading}>
              {loading ? "更新中…" : "更新"}
            </Button>
          </div>
        </div>

        <SalesTabs />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">フィルタ</CardTitle>
          <CardDescription>ダッシュボードは「KPI即見え」を最優先。詳細は上のタブへ。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">store_id</div>
              <input
                type="number"
                min={1}
                value={storeId}
                onChange={(e) => setStoreId(Math.max(1, Number(e.target.value || 1)))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">sales_mode</div>
              <select
                value={salesMode}
                onChange={(e) => setSalesMode(e.target.value as SalesMode)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              >
                <option value="exclusive">税抜（exclusive）</option>
                <option value="inclusive">税込（inclusive）</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">期間プリセット</div>
              <div className="flex gap-2">
                {(["7", "30", "90", "custom"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={preset === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreset(p)}
                  >
                    {p === "custom" ? "カスタム" : `${p}日`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">期間</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={range.start}
                  onChange={(e) => {
                    setPreset("custom");
                    setStartDate(e.target.value);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
                />
                <input
                  type="date"
                  value={range.end}
                  onChange={(e) => {
                    setPreset("custom");
                    setEndDate(e.target.value);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard title="売上" value={formatJPY(kpi.s)} />
        <KpiCard title="原価" value={formatJPY(kpi.c)} />
        <KpiCard title="粗利" value={formatJPY(kpi.p)} tone={kpi.p >= 0 ? "good" : "bad"} />
        <KpiCard title="粗利率" value={formatPct(kpi.mr)} sub="profit / sales" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">日次トレンド</CardTitle>
            <CardDescription>線：売上 / 粗利（クリックで日次へ）</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickMargin={8} minTickGap={24} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => {
                          const n = safeNumber(value);
                          if (name === "margin_rate") return [formatPct(n), "粗利率"];
                          return [formatJPY(n), String(name)];
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    dot={false}
                    strokeWidth={2}
                    onClick={(p: any) => p?.activeLabel && onClickDay(String(p.activeLabel))}
                  />
                  <Line type="monotone" dataKey="profit" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>

            <Separator className="my-4" />

            <div className="text-sm font-medium">直近14日（クリックで日次）</div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="py-2 text-left font-medium">日付</th>
                    <th className="py-2 text-right font-medium">売上</th>
                    <th className="py-2 text-right font-medium">原価</th>
                    <th className="py-2 text-right font-medium">粗利</th>
                    <th className="py-2 text-right font-medium">粗利率</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.slice(-14).map((r) => (
                    <tr
                      key={r.date}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => onClickDay(r.date)}
                    >
                      <td className="py-2 font-medium">{r.date}</td>
                      <td className="py-2 text-right">{formatJPY(r.sales)}</td>
                      <td className="py-2 text-right">{formatJPY(r.cost)}</td>
                      <td className="py-2 text-right">{formatJPY(r.profit)}</td>
                      <td className="py-2 text-right">{formatPct(r.margin_rate)}</td>
                    </tr>
                  ))}
                  {!loading && daily.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={5}>
                        データがありません
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">日別 粗利（棒）</CardTitle>
            <CardDescription>棒クリックで日次へ</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickMargin={8} minTickGap={24} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [formatJPY(safeNumber(value)), String(name)]}
                      />
                    }
                  />
                  <Bar
                    dataKey="profit"
                    onClick={(d: any) => d?.date && onClickDay(String(d.date))}
                    className={cn("cursor-pointer")}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}