"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import { CartesianGrid, ResponsiveContainer, XAxis, YAxis, BarChart, Bar } from "recharts";

// ✅ api.ts 側の関数に統一（名前が違うならここだけ直す）
import { getProfitByWork, type SalesMode } from "@/lib/api";

type ProfitByWorkRowView = {
  work_id: string;
  work_name: string;
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number; // 0..1
};

const LS_STORE_ID = "vlp_store_id";
const LS_SALES_MODE = "vlp_sales_mode";

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

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const escape = (v: unknown) => {
    const raw = v === null || v === undefined ? "" : String(v);
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
    tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? "/sales/by-work";

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

export default function SalesByWorkPage() {
  const today = React.useMemo(() => toISODate(new Date()), []);
  const [storeId, setStoreId] = React.useState<number>(1);
  const [salesMode, setSalesMode] = React.useState<SalesMode>("exclusive");
  const [startDate, setStartDate] = React.useState<string>(addDays(today, -29));
  const [endDate, setEndDate] = React.useState<string>(today);

  const [rows, setRows] = React.useState<ProfitByWorkRowView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

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

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      // ✅ api.ts 引数名に統一（date_from/date_to）
      const res = await getProfitByWork({
        date_from: range.start,
        date_to: range.end,
        store_id: String(storeId),
        sales_mode: salesMode,
      });

      // 返り値の形は api.ts に依存するので吸収（rows が無ければ配列直も許容）
      const rawRows: any[] = Array.isArray((res as any)?.rows) ? (res as any).rows : Array.isArray(res as any) ? (res as any) : [];

      const data: ProfitByWorkRowView[] = rawRows.map((r: any, idx: number) => {
        const sales = safeNumber(r.sales);
        const profit = safeNumber(r.profit);
        const workId = String(r.work_id ?? r.workId ?? r.id ?? idx);
        const workName = String(r.work_name ?? r.workName ?? r.name ?? workId);

        return {
          work_id: workId,
          work_name: workName,
          sales,
          cost: safeNumber(r.cost),
          profit,
          // margin_rate が無い/NaN の場合は算出
          margin_rate: Number.isFinite(r.margin_rate) ? safeNumber(r.margin_rate) : sales ? profit / sales : 0,
        };
      });

      data.sort((a, b) => b.profit - a.profit);
      setRows(data);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "データ取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, salesMode, range.start, range.end]);

  const totals = React.useMemo(() => {
    const sales = rows.reduce((a, r) => a + r.sales, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const profit = rows.reduce((a, r) => a + r.profit, 0);
    const mr = sales ? profit / sales : 0;
    return { sales, cost, profit, mr };
  }, [rows]);

  const chartData = React.useMemo(() => {
    return rows.slice(0, 20).map((r) => ({
      name: r.work_name,
      profit: r.profit,
      sales: r.sales,
    }));
  }, [rows]);

  const onExport = () => downloadCSV(`sales_by_work_store-${storeId}_${salesMode}_${range.start}_${range.end}.csv`, rows);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xl font-semibold tracking-tight">作業別</div>
            <div className="text-sm text-muted-foreground">
              store_id={storeId} / {salesMode} / {range.start} - {range.end}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onExport} disabled={rows.length === 0}>
              CSV
            </Button>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? "更新中…" : "更新"}
            </Button>
          </div>
        </div>

        <SalesTabs />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">フィルタ</CardTitle>
          <CardDescription>期間と税区分を切り替え。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
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
            <div className="text-xs font-medium text-muted-foreground">start_date</div>
            <input
              type="date"
              value={range.start}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">end_date</div>
            <input
              type="date"
              value={range.end}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
            />
          </div>

          {error ? (
            <div className="md:col-span-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi title="売上" value={formatJPY(totals.sales)} />
        <Kpi title="原価" value={formatJPY(totals.cost)} />
        <Kpi title="粗利" value={formatJPY(totals.profit)} />
        <Kpi title="粗利率" value={formatPct(totals.mr)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">粗利（上位20作業）</CardTitle>
            <CardDescription>棒：粗利 / 参考：売上</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickMargin={8} interval={0} angle={-20} textAnchor="end" height={80} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value, name) => [formatJPY(safeNumber(value)), String(name)]} />}
                  />
                  <Bar dataKey="profit" name="粗利" />
                  <Bar dataKey="sales" name="売上" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">作業別一覧</CardTitle>
            <CardDescription>利益順（全件）</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-3" />
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-muted-foreground">
                    <th className="py-2 text-left font-medium">作業</th>
                    <th className="py-2 text-right font-medium">粗利</th>
                    <th className="py-2 text-right font-medium">粗利率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.work_id} className="border-b hover:bg-muted/50">
                      <td className="py-2 font-medium">{r.work_name}</td>
                      <td className="py-2 text-right">{formatJPY(r.profit)}</td>
                      <td className="py-2 text-right">{formatPct(r.margin_rate)}</td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={3}>
                        データがありません
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}