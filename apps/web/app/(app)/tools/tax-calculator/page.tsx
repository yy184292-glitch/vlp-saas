"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  calculateTax,
  VEHICLE_TYPES,
  ECO_TYPES,
  JIBAISEKI_MONTHS_OPTIONS,
  type TaxCalcResult,
} from "@/lib/api";

function fmtYen(n: number) {
  return `¥${Math.trunc(n).toLocaleString()}`;
}

const currentYear = new Date().getFullYear();

export default function TaxCalculatorPage() {
  const [vehicleType, setVehicleType] = React.useState("passenger");
  const [weightKg, setWeightKg] = React.useState("1500");
  const [firstRegYear, setFirstRegYear] = React.useState(String(currentYear - 3));
  const [firstRegMonth, setFirstRegMonth] = React.useState("1");
  const [ecoType, setEcoType] = React.useState("non_eco");
  const [jibaisekiMonths, setJibaisekiMonths] = React.useState(25);
  const [inspectionYears, setInspectionYears] = React.useState(2);

  const [result, setResult] = React.useState<TaxCalcResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCalc() {
    setLoading(true);
    setError(null);
    try {
      const r = await calculateTax({
        vehicle_type: vehicleType,
        weight_kg: Number(weightKg),
        first_reg_year: Number(firstRegYear),
        first_reg_month: Number(firstRegMonth),
        eco_type: ecoType,
        jibaiseki_months: jibaisekiMonths,
        inspection_years: inspectionYears,
      });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "計算に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <div className="text-xl font-semibold tracking-tight">自賠責・重量税 計算機</div>
        <div className="text-sm text-muted-foreground">2024年度法定料金に基づいて計算します</div>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="text-sm font-semibold">入力条件</div>
        <Separator />

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">車種区分</Label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">車両重量（kg）</Label>
            <Input
              type="number" min={0} step={50}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">初年度登録年</Label>
            <select
              value={firstRegYear}
              onChange={(e) => setFirstRegYear(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {Array.from({ length: 40 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}年（西暦）</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">初年度登録月</Label>
            <select
              value={firstRegMonth}
              onChange={(e) => setFirstRegMonth(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">エコカー区分</Label>
            <select
              value={ecoType}
              onChange={(e) => setEcoType(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {ECO_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">自賠責加入期間</Label>
            <select
              value={jibaisekiMonths}
              onChange={(e) => setJibaisekiMonths(Number(e.target.value))}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {JIBAISEKI_MONTHS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">車検期間</Label>
            <select
              value={inspectionYears}
              onChange={(e) => setInspectionYears(Number(e.target.value))}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value={2}>2年</option>
              <option value={1}>1年</option>
            </select>
          </div>
        </div>

        <Button onClick={() => void handleCalc()} disabled={loading} className="w-full">
          {loading ? "計算中..." : "計算する"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border bg-card p-4 space-y-4">
          <div className="text-sm font-semibold">計算結果</div>
          <Separator />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground mb-1">自賠責保険料</div>
              <div className="text-2xl font-bold tabular-nums">{fmtYen(result.jibaiseki)}</div>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground mb-1">自動車重量税</div>
              <div className="text-2xl font-bold tabular-nums">{fmtYen(result.jyuryozei)}</div>
            </div>
            <div className="rounded-md border bg-primary/10 border-primary/30 p-4">
              <div className="text-xs text-muted-foreground mb-1">合計</div>
              <div className="text-2xl font-bold tabular-nums text-primary">{fmtYen(result.total)}</div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            車齢: {result.vehicle_age}年 ／
            {result.age_category === "under13" ? " 13年未満（通常税率）" :
             result.age_category === "13to18" ? " 13〜18年未満（重課）" :
             " 18年以上（重課）"}
          </div>

          {result.notes.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
              {result.notes.map((n, i) => (
                <div key={i} className="text-xs text-amber-400">※ {n}</div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            ※ 2024年度法定料金に基づく概算です。正確な金額は保険会社・運輸局にてご確認ください。
          </div>
        </div>
      )}
    </div>
  );
}
