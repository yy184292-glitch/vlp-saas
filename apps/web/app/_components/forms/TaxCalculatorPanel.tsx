"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Props {
  /** 計算結果を明細に追加するコールバック。jibaiseki/jyuryozei を渡す */
  onAdd: (jibaiseki: number, jyuryozei: number) => void;
  /** 車両の初年度登録年月を自動セットする場合 */
  defaultFirstRegYear?: number | null;
  defaultFirstRegMonth?: number | null;
  defaultWeightKg?: number | null;
}

export function TaxCalculatorPanel({
  onAdd,
  defaultFirstRegYear,
  defaultFirstRegMonth,
  defaultWeightKg,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [vehicleType, setVehicleType] = React.useState("passenger");
  const [weightKg, setWeightKg] = React.useState(defaultWeightKg ? String(defaultWeightKg) : "1500");
  const [firstRegYear, setFirstRegYear] = React.useState(
    defaultFirstRegYear ? String(defaultFirstRegYear) : String(new Date().getFullYear() - 3)
  );
  const [firstRegMonth, setFirstRegMonth] = React.useState(
    defaultFirstRegMonth ? String(defaultFirstRegMonth) : "1"
  );
  const [ecoType, setEcoType] = React.useState("non_eco");
  const [jibaisekiMonths, setJibaisekiMonths] = React.useState(25);
  const [inspectionYears, setInspectionYears] = React.useState(2);
  const [result, setResult] = React.useState<TaxCalcResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function handleCalc() {
    setLoading(true);
    setErr(null);
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
      setErr(e instanceof Error ? e.message : "計算失敗");
    } finally {
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Calculator className="h-4 w-4" />
        法定費用を自動計算（自賠責・重量税）
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">車種区分</Label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">車両重量（kg）</Label>
              <Input
                type="number"
                min={0}
                step={50}
                className="h-9 text-sm"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">初年度登録年</Label>
              <select
                value={firstRegYear}
                onChange={(e) => setFirstRegYear(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {Array.from({ length: 40 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">初年度登録月</Label>
              <select
                value={firstRegMonth}
                onChange={(e) => setFirstRegMonth(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
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
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value={2}>2年</option>
                <option value={1}>1年</option>
              </select>
            </div>
          </div>

          <Button type="button" size="sm" onClick={() => void handleCalc()} disabled={loading}>
            {loading ? "計算中..." : "計算する"}
          </Button>

          {err && <div className="text-xs text-destructive">{err}</div>}

          {result && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">自賠責保険料</div>
                  <div className="font-bold tabular-nums">{fmtYen(result.jibaiseki)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">自動車重量税</div>
                  <div className="font-bold tabular-nums">{fmtYen(result.jyuryozei)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">合計</div>
                  <div className="font-bold tabular-nums text-primary">{fmtYen(result.total)}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                車齢 {result.vehicle_age}年（{result.age_category === "under13" ? "13年未満" : result.age_category === "13to18" ? "13〜18年未満" : "18年以上"}）
              </div>
              {result.notes.length > 0 && (
                <ul className="text-xs text-amber-400 space-y-0.5">
                  {result.notes.map((n, i) => <li key={i}>※ {n}</li>)}
                </ul>
              )}
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => onAdd(result.jibaiseki, result.jyuryozei)}
              >
                計算して明細に追加（非課税）
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
