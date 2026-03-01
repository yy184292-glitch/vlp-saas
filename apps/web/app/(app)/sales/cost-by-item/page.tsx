"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import { CartesianGrid, ResponsiveContainer, XAxis, YAxis, BarChart, Bar, PieChart, Pie } from "recharts";

// ✅ api.ts 側の関数に統一（名前が違うならここだけ直す）
import { getCostByItem, type SalesMode } from "@/lib/api";

type CostByItemRowView = {
  item_id: string;
  item_name: string;
  cost: number;
  quantity?: number;
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
    tabs.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? "/sales/cost-by-item";

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

export default function SalesCostByItemPage() {
  const today = React.useMemo(() => toISODate(new Date()), []);
  const [storeId, setStoreId] = React.useState<number>(1);
  const [salesMode, setSalesMode] = React.useState<SalesMode>("exclusive");
  const [startDate, setStartDate] = React.useState<string>(addDays(today, -29));
  const [endDate, setEndDate] = React.useState<string>(today);

  const [rows, setRows] = React.useState<CostByItemRowView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

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

  const chartConfig = React.useMemo<ChartConfig>(() => ({ cost: { label: "原価" } }), []);

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      // ✅ api.ts 引数名に統一（date_from/date_to）
      const res = await getCostByItem({
        date_from: range.start,
        date_to: range.end,
        store_id: String(storeId),
        sales_mode: salesMode,
      });

      // 返り値の形は api.ts に依存するので吸収（rows が無ければ配列直も許容）
      const rawRows: any[] = Array.isArray((res as any)?.rows)
        ? (res as any).rows
        : Array.isArray(res as any)
          ? (res as any)
          : [];

      const data: CostByItemRowView[] = rawRows.map((r: any, idx: number) => {
        const itemId = String(r.item_id ?? r.itemId ?? r.id ?? idx);
        const itemName = String(r.item_name ?? r.itemName ?? r.name ?? itemId);
        const qty = r.quantity !== undefined ? safeNumber(r.quantity) : undefined;

        return {
          item_id: itemId,
          item_name: itemName,
          cost: safeNumber(r.cost),
          quantity: qty,
        };
      });

      data.sort((a, b) => b.cost - a.cost);
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
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    return { cost, items: rows.length };
  }, [rows]);

  const topBar = React.useMemo(
    () =>
      rows.slice(0, 20).map((r) => ({
        name: r.item_name,
        cost: r.cost,
      })),
    [rows]
  );

  const pieData = React.useMemo(() => {
    const top = rows.slice(0, 5);
    const otherCost = rows.slice(5).reduce((a, r) => a + r.cost, 0);
    const base = top.map((r) => ({
      name: r.item_name,
      value: r.cost,
    }));
    if (otherCost > 0) base.push({ name: "その他", value: otherCost });
    return base;
  }, [rows]);

  const onExport = () =>
    downloadCSV(`sales_cost_by_item_store-${storeId}_${salesMode}_${range.start}_${range.end}.csv`, rows);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xl font-semibold tracking-tight">部材別原価</div>
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
          <CardDescription>期間・税区分を切り替え。</CardDescription>
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

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>原価（合計）</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{formatJPY(totals.cost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>品目数</CardDescription>
            <CardTitle className="text-3xl tracking-tight">{totals.items}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>表示</CardDescription>
            <CardTitle className="text-3xl tracking-tight">Top 20</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">原価（上位20）</CardTitle>
            <CardDescription>棒：原価</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBar} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickMargin={8} interval={0} angle={-20} textAnchor="end" height={80} />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => [formatJPY(safeNumber(v)), "原価"]} />} />
                  <Bar dataKey="cost" name="原価" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">構成比（上位5 + その他）</CardTitle>
            <CardDescription>偏りの把握</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={120} label />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">部材別一覧</CardTitle>
          <CardDescription>原価順</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-3" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-muted-foreground">
                  <th className="py-2 text-left font-medium">部材</th>
                  <th className="py-2 text-right font-medium">原価</th>
                  <th className="py-2 text-right font-medium">数量</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.item_id} className="border-b hover:bg-muted/50">
                    <td className="py-2 font-medium">{r.item_name}</td>
                    <td className="py-2 text-right">{formatJPY(r.cost)}</td>
                    <td className="py-2 text-right">{r.quantity !== undefined ? r.quantity : "-"}</td>
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
  );
}