"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type StoreSettings = {
  store_id: string;
  tax_rate: string; // decimal string
  auto_expense_on_stock_in: boolean;
};

function toPercentText(rate: string) {
  const n = Number(rate);
  if (Number.isFinite(n)) return `${Math.round(n * 10000) / 100}%`;
  return rate;
}

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<StoreSettings | null>(null);

  const [taxRate, setTaxRate] = React.useState("0.10");
  const [autoExpense, setAutoExpense] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await apiFetch<StoreSettings>("/api/v1/settings/store");
      setSettings(s);
      setTaxRate(String(s.tax_rate ?? "0.10"));
      setAutoExpense(!!s.auto_expense_on_stock_in);
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
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [settings, taxRate, autoExpense]);

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

          <div className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4">
            <div className="space-y-1">
              <div className="font-medium">在庫入庫 → 経費（部材）自動計上</div>
              <div className="text-sm text-muted-foreground">
                入庫した金額（仕入れ値×個数）を自動で経費に追加し、二重入力を防ぎます。
              </div>
            </div>
            <Switch checked={autoExpense} onCheckedChange={setAutoExpense} />
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
