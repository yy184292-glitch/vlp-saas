"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ApiError,
  getProfitDaily,
  getProfitMonthly,
  type ProfitDailyResponse,
  type ProfitMonthlyResponse,
  type SalesMode,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
} from "recharts";

type SeriesKey = "sales" | "cost" | "profit" | "margin_rate";

type MonthlyChartRow = {
  month: string; // YYYY-MM
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number; // 0..1
};

type DailyChartRow = {
  day: string; // YYYY-MM-DD
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number; // 0..1
};

// dashboard と揃える（※ dashboard側が違うキーなら合わせて変更）
const LS_STORE_ID = "vlp_store_id";
const LS_SALES_MODE = "vlp_sales_mode";

function toYyyyMmDdLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function toYyyyMmLocal(d: Date): string {
  return toYyyyMmDdLocal(d).slice(0, 7);
}
function firstDayOfMonth(yyyyMm: string): string {
  return `${yyyyMm}-01`;
}
function lastDayOfMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m, 0);
  return toYyyyMmDdLocal(d);
}
function addMonths(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  return toYyyyMmLocal(d);
}
function safeDiv(a: number, b: number): number {
  if (!b) return 0;
  return a / b;
}
function formatYen(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(v);
}
function formatPct(r: number): string {
  const v = Number.isFinite(r) ? r : 0;
  return `${(v * 100).toFixed(1)}%`;
}
function extractErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Failed";
}

function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    // CSV injection 対策（Excel等）
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
    return safe;
  };
  return `${headers.join(",")}\n${rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n")}\n`;
}
function downloadText(filename: string, text: string, mime = "text/csv") {
  const blob = new Blob([text], { type: mime });
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
    tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? "/sales/monthly";

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

function keyToName(k: SeriesKey): string {
  if (k === "sales") return "売上";
  if (k === "cost") return "原価";
  if (k === "profit") return "粗利";
  return "粗利率";
}
function nameToKey(name: string): SeriesKey {
  if (name === "売上") return "sales";
  if (name === "原価") return "cost";
  if (name === "粗利") return "profit";
  if (name === "粗利率") return "margin_rate";
  if (name === "sales" || name === "cost" || name === "profit" || name === "margin_rate") return name;
  return "sales";
}

export default function SalesMonthlyPage() {
  const now = React.useMemo(() => new Date(), []);
  const defaultMonth = React.useMemo(() => toYyyyMmLocal(now), [now]);

  const [storeId, setStoreId] = React.useState<string>("");
  const [salesMode, setSalesMode] = React.useState<SalesMode>("exclusive");

  const [monthFrom, setMonthFrom] = React.useState(defaultMonth);
  const [monthTo, setMonthTo] = React.useState(defaultMonth);

  const dateFrom = React.useMemo(() => firstDayOfMonth(monthFrom), [monthFrom]);
  const dateTo = React.useMemo(() => lastDayOfMonth(monthTo), [monthTo]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [monthly, setMonthly] = React.useState<ProfitMonthlyResponse | null>(null);

  const [barLeft, setBarLeft] = React.useState<SeriesKey>("sales");
  const [barRight, setBarRight] = React.useState<SeriesKey>("cost");
  const [lineKey, setLineKey] = React.useState<SeriesKey>("profit");

  const [selectedMonth, setSelectedMonth] = React.useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = React.useState(false);
  const [dailyError, setDailyError] = React.useState<string | null>(null);
  const [daily, setDaily] = React.useState<ProfitDailyResponse | null>(null);

  // dashboard と同じ永続化キーに統一
  React.useEffect(() => {
    try {
      const s = localStorage.getItem(LS_STORE_ID);
      const m = localStorage.getItem(LS_SALES_MODE) as SalesMode | null;
      if (s) setStoreId(String(s));
      if (m === "exclusive" || m === "inclusive") setSalesMode(m);
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      if (storeId) localStorage.setItem(LS_STORE_ID, storeId);
      localStorage.setItem(LS_SALES_MODE, salesMode);
    } catch {}
  }, [storeId, salesMode]);

  const monthlyChartRows: MonthlyChartRow[] = React.useMemo(() => {
    const rows = monthly?.rows ?? [];
    return rows
      .slice()
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map((r) => ({
        month: r.month.slice(0, 7),
        sales: r.sales ?? 0,
        cost: r.cost ?? 0,
        profit: r.profit ?? 0,
        margin_rate: safeDiv(r.profit ?? 0, r.sales ?? 0),
      }));
  }, [monthly]);

  const totals = React.useMemo(() => {
    const rows = monthly?.rows ?? [];
    const sales = rows.reduce((acc, r) => acc + (r.sales ?? 0), 0);
    const cost = rows.reduce((acc, r) => acc + (r.cost ?? 0), 0);
    const profit = rows.reduce((acc, r) => acc + (r.profit ?? 0), 0);
    return { sales, cost, profit, margin_rate: safeDiv(profit, sales), months: rows.length };
  }, [monthly]);

  const dailyChartRows: DailyChartRow[] = React.useMemo(() => {
    const rows = daily?.rows ?? [];
    return rows
      .slice()
      .sort((a, b) => (a.day < b.day ? -1 : 1))
      .map((r) => ({
        day: r.day,
        sales: r.sales ?? 0,
        cost: r.cost ?? 0,
        profit: r.profit ?? 0,
        margin_rate: safeDiv(r.profit ?? 0, r.sales ?? 0),
      }));
  }, [daily]);

  function presetLast12Months() {
    setMonthFrom(addMonths(defaultMonth, -11));
    setMonthTo(defaultMonth);
  }
  function presetThisYear() {
    const y = now.getFullYear();
    setMonthFrom(`${y}-01`);
    setMonthTo(`${y}-12`);
  }
  function presetThisFY() {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const fyStart = m >= 4 ? y : y - 1;
    setMonthFrom(`${fyStart}-04`);
    setMonthTo(`${fyStart + 1}-03`);
  }
  function shiftRange(delta: number) {
    setMonthFrom((p) => addMonths(p, delta));
    setMonthTo((p) => addMonths(p, delta));
  }

  async function runMonthly() {
    setLoading(true);
    setError(null);
    setMonthly(null);
    setSelectedMonth(null);
    setDaily(null);
    setDailyError(null);

    try {
      if (!storeId) throw new Error("store_id を入力してください");
      if (monthTo < monthFrom) throw new Error("to（月）は from（月）以上にしてください");

      const res = await getProfitMonthly({
        date_from: dateFrom,
        date_to: dateTo,
        store_id: storeId,
        sales_mode: salesMode,
      });

      setMonthly(res);
    } catch (e) {
      setError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function runDaily(yyyyMm: string) {
    setDailyLoading(true);
    setDailyError(null);
    setDaily(null);

    try {
      if (!storeId) throw new Error("store_id が必要です");

      const res = await getProfitDaily({
        date_from: firstDayOfMonth(yyyyMm),
        date_to: lastDayOfMonth(yyyyMm),
        store_id: storeId,
        sales_mode: salesMode,
      });

      setDaily(res);
    } catch (e) {
      setDailyError(extractErrorMessage(e));
    } finally {
      setDailyLoading(false);
    }
  }

  // storeId が復元できてたら自動実行（運用導線短縮）
  React.useEffect(() => {
    if (storeId) runMonthly().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function onClickMonth(yyyyMm: string) {
    setSelectedMonth(yyyyMm);
    runDaily(yyyyMm).catch(() => {});
  }

  function exportMonthlyCsv() {
    const rows = monthlyChartRows.map((r) => ({
      month: r.month,
      sales: r.sales,
      cost: r.cost,
      profit: r.profit,
      margin_rate: r.margin_rate,
    }));
    downloadText(
      `profit_monthly_${monthFrom}_to_${monthTo}.csv`,
      toCsv(rows, ["month", "sales", "cost", "profit", "margin_rate"])
    );
  }

  function exportDailyCsv() {
    if (!selectedMonth || dailyChartRows.length === 0) return;
    const rows = dailyChartRows.map((r) => ({
      day: r.day,
      sales: r.sales,
      cost: r.cost,
      profit: r.profit,
      margin_rate: r.margin_rate,
    }));
    downloadText(`profit_daily_${selectedMonth}.csv`, toCsv(rows, ["day", "sales", "cost", "profit", "margin_rate"]));
  }

  const valueFmt = (k: SeriesKey, v: number) => (k === "margin_rate" ? formatPct(v) : formatYen(v));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xl font-semibold tracking-tight">月次（売上・粗利）</div>
            <div className="text-sm text-muted-foreground">
              store_id={storeId || "-"} / {salesMode} / {dateFrom} - {dateTo}
            </div>
          </div>
          <Badge variant="outline">{new Date().toLocaleString("ja-JP")}</Badge>
        </div>

        <SalesTabs />
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">フィルタ</CardTitle>
          <CardDescription>月をクリックすると日次へ。CSVも出力できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-muted-foreground">store_id</div>
              <input
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="例: 6e46adec-..."
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
              <div className="text-xs font-medium text-muted-foreground">範囲操作</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => shiftRange(-1)}>
                  ◀ 1ヶ月
                </Button>
                <Button variant="outline" size="sm" onClick={() => shiftRange(1)}>
                  1ヶ月 ▶
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">from（月）</div>
              <input
                type="month"
                value={monthFrom}
                onChange={(e) => setMonthFrom(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">to（月）</div>
              <input
                type="month"
                value={monthTo}
                onChange={(e) => setMonthTo(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="text-xs font-medium text-muted-foreground">プリセット</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMonthFrom(defaultMonth);
                    setMonthTo(defaultMonth);
                  }}
                >
                  今月
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const last = addMonths(defaultMonth, -1);
                    setMonthFrom(last);
                    setMonthTo(last);
                  }}
                >
                  先月
                </Button>
                <Button variant="outline" size="sm" onClick={presetLast12Months}>
                  直近12ヶ月
                </Button>
                <Button variant="outline" size="sm" onClick={presetThisYear}>
                  今年（1-12）
                </Button>
                <Button variant="outline" size="sm" onClick={presetThisFY}>
                  今年度（4-3）
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={runMonthly} disabled={loading}>
              {loading ? "集計中…" : "更新"}
            </Button>
            <Button variant="outline" onClick={exportMonthlyCsv} disabled={!monthlyChartRows.length}>
              月次CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportDailyCsv}
              disabled={!selectedMonth || dailyChartRows.length === 0}
            >
              日次CSV（選択月）
            </Button>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              エラー: {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard title="売上" value={monthly ? formatYen(totals.sales) : "-"} sub={`${totals.months}ヶ月`} />
        <KpiCard title="原価" value={monthly ? formatYen(totals.cost) : "-"} sub="stock_moves 原価" />
        <KpiCard
          title="粗利"
          value={monthly ? formatYen(totals.profit) : "-"}
          sub={`粗利率 ${monthly ? formatPct(totals.margin_rate) : "-"}`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">表示切替</CardTitle>
            <CardDescription>棒2本 + 折れ線を切り替え</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <div className="text-xs font-medium text-muted-foreground">棒（左）</div>
              <select
                value={barLeft}
                onChange={(e) => setBarLeft(e.target.value as SeriesKey)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              >
                <option value="sales">売上</option>
                <option value="cost">原価</option>
                <option value="profit">粗利</option>
              </select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-medium text-muted-foreground">棒（右）</div>
              <select
                value={barRight}
                onChange={(e) => setBarRight(e.target.value as SeriesKey)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              >
                <option value="sales">売上</option>
                <option value="cost">原価</option>
                <option value="profit">粗利</option>
              </select>
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-medium text-muted-foreground">折れ線</div>
              <select
                value={lineKey}
                onChange={(e) => setLineKey(e.target.value as SeriesKey)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              >
                <option value="profit">粗利</option>
                <option value="sales">売上</option>
                <option value="cost">原価</option>
                <option value="margin_rate">粗利率</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">月次（棒）</CardTitle>
            <CardDescription>クリックで日次へ</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartRows}
                margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                onClick={(state: any) => {
                  const idx = state?.activeTooltipIndex;
                  const m = idx !== undefined ? monthlyChartRows[idx]?.month : null;
                  if (m) onClickMonth(m);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(v: any, name: any) => [valueFmt(nameToKey(name), Number(v)), name]}
                  labelFormatter={(l) => `月: ${l}（クリックで日次）`}
                />
                <Legend />
                <Bar dataKey={barLeft} name={keyToName(barLeft)} />
                <Bar dataKey={barRight} name={keyToName(barRight)} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">月次（折れ線）</CardTitle>
            <CardDescription>利益のブレ / 粗利率</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChartRows} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickMargin={8} />
                <YAxis
                  tickFormatter={(v) =>
                    lineKey === "margin_rate"
                      ? `${Math.round(Number(v) * 100)}%`
                      : `${Math.round(Number(v) / 1000)}k`
                  }
                />
                <Tooltip
                  formatter={(v: any, name: any) => [valueFmt(nameToKey(name), Number(v)), name]}
                  labelFormatter={(l) => `月: ${l}`}
                />
                <Legend />
                <Line type="monotone" dataKey={lineKey} name={keyToName(lineKey)} dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">月次明細</CardTitle>
          <CardDescription>行クリックで日次へ</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-muted-foreground">
                <th className="py-2 text-left font-medium">月</th>
                <th className="py-2 text-right font-medium">売上</th>
                <th className="py-2 text-right font-medium">原価</th>
                <th className="py-2 text-right font-medium">粗利</th>
                <th className="py-2 text-right font-medium">粗利率</th>
              </tr>
            </thead>
            <tbody>
              {monthlyChartRows.length === 0 ? (
                <tr>
                  <td className="py-6 text-muted-foreground" colSpan={5}>
                    {loading ? "集計中…" : "データなし"}
                  </td>
                </tr>
              ) : (
                monthlyChartRows.map((r) => (
                  <tr
                    key={r.month}
                    onClick={() => onClickMonth(r.month)}
                    className={`border-b hover:bg-muted/50 cursor-pointer ${
                      selectedMonth === r.month ? "bg-muted/40" : ""
                    }`}
                    title="クリックで日次へ"
                  >
                    <td className="py-2 font-medium">{r.month}</td>
                    <td className="py-2 text-right">{formatYen(r.sales)}</td>
                    <td className="py-2 text-right">{formatYen(r.cost)}</td>
                    <td className="py-2 text-right">{formatYen(r.profit)}</td>
                    <td className="py-2 text-right">{formatPct(r.margin_rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {monthlyChartRows.length > 0 ? (
              <tfoot>
                <tr className="border-t">
                  <td className="py-2 font-semibold">合計</td>
                  <td className="py-2 text-right font-semibold">{formatYen(totals.sales)}</td>
                  <td className="py-2 text-right font-semibold">{formatYen(totals.cost)}</td>
                  <td className="py-2 text-right font-semibold">{formatYen(totals.profit)}</td>
                  <td className="py-2 text-right font-semibold">{formatPct(totals.margin_rate)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </CardContent>
      </Card>

      {/* Daily Drilldown */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            日次（{selectedMonth ? `${selectedMonth} の内訳` : "月をクリックして表示"}）
          </CardTitle>
          <CardDescription>日次グラフ + CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" onClick={exportDailyCsv} disabled={!selectedMonth || dailyChartRows.length === 0}>
              日次CSV
            </Button>
            {dailyLoading ? <span className="text-xs text-muted-foreground">ロード中…</span> : null}
            {dailyError ? <span className="text-xs text-destructive">エラー: {dailyError}</span> : null}
          </div>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartRows} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tickMargin={8} />
                <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v: any, name: any) => [formatYen(Number(v)), name]} labelFormatter={(l) => `日: ${l}`} />
                <Legend />
                <Bar dataKey="sales" name="売上" />
                <Bar dataKey="cost" name="原価" />
                <Bar dataKey="profit" name="粗利" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Separator />

          <details>
            <summary className="cursor-pointer font-semibold">日次JSON（デバッグ）</summary>
            <pre className="mt-2 max-h-[380px] overflow-auto rounded-md bg-muted p-3 text-xs">
              {daily ? JSON.stringify(daily, null, 2) : "{}"}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      {sub ? <CardContent className="pt-0 text-xs text-muted-foreground">{sub}</CardContent> : <CardContent className="pt-0" />}
    </Card>
  );
}