"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ValuationSettings = {
  provider: string;

  market_zip: string;
  market_radius_miles: number;
  market_miles_band: number;
  market_car_type: string;
  market_currency: string;
  market_fx_rate: number;

  display_adjust_pct: number;
  buy_cap_pct: number;
  recommended_from_cap_yen: number;
  risk_buffer_yen: number;
  round_unit_yen: number;
  default_extra_cost_yen: number;
  min_profit_yen: number;
  min_profit_rate: number;
};

export default function ValuationSettingsPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [s, setS] = React.useState<ValuationSettings | null>(null);

  const [form, setForm] = React.useState<ValuationSettings | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await apiFetch<ValuationSettings>("/api/v1/valuation/settings");
      setS(v);
      setForm(v);
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
    if (!form) return;
    if (!form.provider.trim()) {
      setError("provider を入力してください");
      return;
    }
    if (!form.market_zip.trim()) {
      setError("market_zip を入力してください（US ZIP）");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        provider: form.provider,
        market_zip: form.market_zip,
        market_radius_miles: Number(form.market_radius_miles),
        market_miles_band: Number(form.market_miles_band),
        market_car_type: form.market_car_type,
        market_currency: form.market_currency,
        market_fx_rate: Number(form.market_fx_rate),

        display_adjust_pct: Number(form.display_adjust_pct),
        buy_cap_pct: Number(form.buy_cap_pct),
        recommended_from_cap_yen: Number(form.recommended_from_cap_yen),
        risk_buffer_yen: Number(form.risk_buffer_yen),
        round_unit_yen: Number(form.round_unit_yen),
        default_extra_cost_yen: Number(form.default_extra_cost_yen),
        min_profit_yen: Number(form.min_profit_yen),
        min_profit_rate: Number(form.min_profit_rate),
      };
      const saved = await apiFetch<ValuationSettings>("/api/v1/valuation/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setS(saved);
      setForm(saved);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">査定設定</div>
          <div className="text-sm text-muted-foreground">外部相場（平均価格）と、買い上限・利益条件などの設定。</div>
        </div>

        <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
          <Link href="/masters">各種マスタへ戻る</Link>
        </Button>
      </div>

      <Separator />

      <Card className="rounded-2xl border-2 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>外部相場プロバイダ</CardTitle>
          <CardDescription>
            provider=MARKETCHECK の場合、MarketCheck Car Search（active listings）の stats=price（mean/median/min/max）を使用します。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          {!form ? <div className="text-sm text-muted-foreground">読み込み中...</div> : null}

          {form ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>provider</Label>
                  <Input
                    value={form.provider}
                    onChange={(e) => setForm((p) => (p ? { ...p, provider: e.target.value } : p))}
                    className="bg-white"
                    placeholder="MARKETCHECK / MAT"
                    list="providerOptions"
                  />
                  <datalist id="providerOptions">
                    <option value="MARKETCHECK" />
                    <option value="MAT" />
                  </datalist>
                </div>

                <div className="grid gap-2">
                  <Label>market_zip（US ZIP）</Label>
                  <Input value={form.market_zip} onChange={(e) => setForm((p) => (p ? { ...p, market_zip: e.target.value } : p))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>market_radius_miles</Label>
                  <Input
                    value={String(form.market_radius_miles)}
                    onChange={(e) => setForm((p) => (p ? { ...p, market_radius_miles: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>market_miles_band（±）</Label>
                  <Input
                    value={String(form.market_miles_band)}
                    onChange={(e) => setForm((p) => (p ? { ...p, market_miles_band: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>market_car_type</Label>
                  <Input
                    value={form.market_car_type}
                    onChange={(e) => setForm((p) => (p ? { ...p, market_car_type: e.target.value } : p))}
                    className="bg-white"
                    placeholder="used / new / certified"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>market_currency</Label>
                  <Input
                    value={form.market_currency}
                    onChange={(e) => setForm((p) => (p ? { ...p, market_currency: e.target.value } : p))}
                    className="bg-white"
                    placeholder="USD"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>market_fx_rate（market_currency→JPY）</Label>
                  <Input
                    value={String(form.market_fx_rate)}
                    onChange={(e) => setForm((p) => (p ? { ...p, market_fx_rate: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>display_adjust_pct（表示調整%）</Label>
                  <Input
                    value={String(form.display_adjust_pct)}
                    onChange={(e) => setForm((p) => (p ? { ...p, display_adjust_pct: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="decimal"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>buy_cap_pct（買い上限係数）</Label>
                  <Input
                    value={String(form.buy_cap_pct)}
                    onChange={(e) => setForm((p) => (p ? { ...p, buy_cap_pct: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="decimal"
                    placeholder="例: 0.7"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>recommended_from_cap_yen（上限からの上乗せ）</Label>
                  <Input
                    value={String(form.recommended_from_cap_yen)}
                    onChange={(e) => setForm((p) => (p ? { ...p, recommended_from_cap_yen: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>risk_buffer_yen（リスクバッファ）</Label>
                  <Input
                    value={String(form.risk_buffer_yen)}
                    onChange={(e) => setForm((p) => (p ? { ...p, risk_buffer_yen: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>round_unit_yen（丸め単位）</Label>
                  <Input
                    value={String(form.round_unit_yen)}
                    onChange={(e) => setForm((p) => (p ? { ...p, round_unit_yen: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>default_extra_cost_yen（諸費用）</Label>
                  <Input
                    value={String(form.default_extra_cost_yen)}
                    onChange={(e) => setForm((p) => (p ? { ...p, default_extra_cost_yen: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>min_profit_yen（最低利益）</Label>
                  <Input
                    value={String(form.min_profit_yen)}
                    onChange={(e) => setForm((p) => (p ? { ...p, min_profit_yen: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="numeric"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>min_profit_rate（最低利益率）</Label>
                  <Input
                    value={String(form.min_profit_rate)}
                    onChange={(e) => setForm((p) => (p ? { ...p, min_profit_rate: Number(e.target.value) } : p))}
                    className="bg-white"
                    inputMode="decimal"
                    placeholder="例: 0.2"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={save} disabled={loading}>
                  保存
                </Button>
                <Button variant="outline" onClick={load} disabled={loading} className="bg-white/70 hover:bg-white">
                  再読み込み
                </Button>
              </div>

              {s ? (
                <div className="text-xs text-muted-foreground">
                  現在の設定: provider={s.provider}, market_zip={s.market_zip}, radius={s.market_radius_miles}mi
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
