"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type StoreSettings = {
  store_id: string;
  tax_rate: string; // decimal string
  auto_expense_on_stock_in: boolean;

  invoice_due_rule_type: "days" | "eom";
  invoice_due_days: number;
  invoice_due_months: number;
};

type Store = {
  id: string;
  name: string;
  logo_url?: string | null;
};

function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    "";
  return base.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function toPercentText(rate: string) {
  const n = Number(rate);
  if (Number.isFinite(n)) return `${Math.round(n * 10000) / 100}%`;
  return rate;
}

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<StoreSettings | null>(null);

  const [store, setStore] = React.useState<Store | null>(null);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);

  const [taxRate, setTaxRate] = React.useState("0.10");
  const [autoExpense, setAutoExpense] = React.useState(true);

  const [invoiceDueRuleType, setInvoiceDueRuleType] = React.useState<"days" | "eom">("days");
  const [invoiceDueDays, setInvoiceDueDays] = React.useState("30");
  const [invoiceDueMonths, setInvoiceDueMonths] = React.useState("0");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await apiFetch<StoreSettings>("/api/v1/settings/store");
      setSettings(s);
      setTaxRate(String(s.tax_rate ?? "0.10"));
      setAutoExpense(!!s.auto_expense_on_stock_in);

      // 店舗情報（ロゴURLなど）
      const st = await apiFetch<Store>(`/api/v1/stores/${s.store_id}`);
      setStore(st);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = React.useCallback(async () => {
    if (!settings) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        store_id: settings.store_id,
        tax_rate: taxRate,
        auto_expense_on_stock_in: autoExpense,
      };
      const s = await apiFetch<StoreSettings>("/api/v1/settings/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSettings(s);

      const st = await apiFetch<Store>(`/api/v1/stores/${s.store_id}`);
      setStore(st);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [settings, taxRate, autoExpense, invoiceDueRuleType, invoiceDueDays, invoiceDueMonths]);

  const uploadLogo = React.useCallback(
    async (file: File) => {
      if (!settings) return;
      setLogoUploading(true);
      setLogoError(null);
      try {
        const form = new FormData();
        form.append("file", file);

        // apiFetch は JSON 前提なので、FormData は fetch で送る
        const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
        const res = await fetch(buildUrl(`/api/v1/stores/${settings.store_id}/logo`), {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: form,
        });

        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || `HTTP ${res.status}`);
        }
        const st = (await res.json()) as Store;
        setStore(st);
      } catch (e) {
        setLogoError(e instanceof Error ? e.message : "ロゴのアップロードに失敗しました");
      } finally {
        setLogoUploading(false);
      }
    },
    [settings]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">設定</div>
          <div className="text-sm text-muted-foreground">税率、自動計上などを店舗ごとに設定します。</div>
        </div>

        <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
          <Link href="/masters">各種マスタへ戻る</Link>
        </Button>
      </div>

      <Separator />

      <Card className="rounded-2xl border-2 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>基本設定</CardTitle>
          <CardDescription>運用に合わせて変更できます。</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="grid gap-2">
            <Label htmlFor="taxRate">消費税率（例: 0.10）</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                id="taxRate"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="max-w-[220px] bg-white"
                inputMode="decimal"
                placeholder="0.10"
              />
              <div className="text-sm text-muted-foreground">現在: {toPercentText(taxRate)}</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="font-medium">店舗ロゴ</div>
                <div className="text-sm text-muted-foreground">
                  見積・請求書に表示できます（推奨: 透過PNG / 横長）。
                </div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                    e.currentTarget.value = "";
                  }}
                />
                <Button variant="outline" disabled={!settings || logoUploading} className="bg-white/70 hover:bg-white">
                  {logoUploading ? "アップロード中…" : "ロゴをアップロード"}
                </Button>
              </label>
            </div>

            {logoError ? <div className="mt-3 text-sm text-destructive">{logoError}</div> : null}

            {store?.logo_url ? (
              <div className="mt-4 flex items-center gap-4">
                <div className="rounded-xl border bg-white p-2 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={buildUrl(store.logo_url)}
                    alt="store logo"
                    className="h-12 w-auto max-w-[240px] object-contain"
                  />
                </div>
                <div className="text-sm text-muted-foreground">現在のロゴ</div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">未設定</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4">
            <div className="space-y-1">
              <div className="font-medium">在庫入庫 → 経費（部材）自動計上</div>
              <div className="text-sm text-muted-foreground">
                入庫した金額（仕入れ値×個数）を自動で経費に追加し、二重入力を防ぎます。
              </div>
            </div>
            <Switch checked={autoExpense} onCheckedChange={setAutoExpense} />
          </div>

<div className="rounded-2xl border bg-white p-4 space-y-4">
  <div className="space-y-1">
    <div className="font-medium">支払期限ルール（見積・請求）</div>
    <div className="text-sm text-muted-foreground">発行日（issued_at）から自動で支払期限を計算します。</div>
  </div>

  <div className="grid gap-2 max-w-[420px]">
    <Label>ルール</Label>
    <Select value={invoiceDueRuleType} onValueChange={(v) => setInvoiceDueRuleType(v as "days" | "eom")}>
      <SelectTrigger className="bg-white">
        <SelectValue placeholder="選択" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="days">発行日から○日</SelectItem>
        <SelectItem value="eom">月末締め（○ヶ月後の月末）</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {invoiceDueRuleType === "days" ? (
    <div className="grid gap-2 max-w-[240px]">
      <Label htmlFor="invoiceDueDays">日数</Label>
      <Input
        id="invoiceDueDays"
        value={invoiceDueDays}
        onChange={(e) => setInvoiceDueDays(e.target.value.replace(/[^0-9]/g, ""))}
        inputMode="numeric"
        className="bg-white"
        placeholder="30"
      />
    </div>
  ) : (
    <div className="grid gap-2 max-w-[240px]">
      <Label htmlFor="invoiceDueMonths">ヶ月後</Label>
      <Input
        id="invoiceDueMonths"
        value={invoiceDueMonths}
        onChange={(e) => setInvoiceDueMonths(e.target.value.replace(/[^0-9]/g, ""))}
        inputMode="numeric"
        className="bg-white"
        placeholder="0"
      />
    </div>
  )}

  <div className="flex flex-wrap gap-2">
    <Button
      type="button"
      variant="outline"
      className="bg-white/70 hover:bg-white"
      onClick={() => {
        setInvoiceDueRuleType("eom");
        setInvoiceDueMonths("0");
      }}
    >
      当月末
    </Button>
    <Button
      type="button"
      variant="outline"
      className="bg-white/70 hover:bg-white"
      onClick={() => {
        setInvoiceDueRuleType("eom");
        setInvoiceDueMonths("1");
      }}
    >
      翌月末
    </Button>
    <Button
      type="button"
      variant="outline"
      className="bg-white/70 hover:bg-white"
      onClick={() => {
        setInvoiceDueRuleType("days");
        setInvoiceDueDays("30");
      }}
    >
      30日
    </Button>
    <Button
      type="button"
      variant="outline"
      className="bg-white/70 hover:bg-white"
      onClick={() => {
        setInvoiceDueRuleType("days");
        setInvoiceDueDays("60");
      }}
    >
      60日
    </Button>
  </div>
</div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || !settings}>
              保存
            </Button>
            <Button variant="outline" onClick={load} disabled={loading} className="bg-white/70 hover:bg-white">
              再読み込み
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
