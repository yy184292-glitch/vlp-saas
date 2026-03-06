import { apiFetch } from "./core";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TaxCalcRequest {
  vehicle_type: string;
  weight_kg: number;
  first_reg_year: number;
  first_reg_month: number;
  eco_type: string;
  jibaiseki_months: number;
  inspection_years: number;
}

export interface TaxCalcResult {
  jibaiseki: number;
  jyuryozei: number;
  total: number;
  vehicle_age: number;
  age_category: string;
  notes: string[];
}

export interface TaxTypeItem {
  value: string;
  label: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const VEHICLE_TYPES: TaxTypeItem[] = [
  { value: "passenger",    label: "自家用乗用車" },
  { value: "kei",          label: "軽自動車（自家用）" },
  { value: "kei_business", label: "軽自動車（営業用）" },
  { value: "bike_small",   label: "小型二輪（250cc超）" },
  { value: "moped",        label: "原付（125cc以下）" },
];

export const ECO_TYPES: TaxTypeItem[] = [
  { value: "non_eco", label: "非エコカー" },
  { value: "exempt",  label: "エコカー免税" },
  { value: "eco_75",  label: "エコカー75%減" },
  { value: "eco_50",  label: "エコカー50%減" },
  { value: "eco_25",  label: "エコカー25%減" },
];

export const JIBAISEKI_MONTHS_OPTIONS = [
  { value: 12, label: "12ヶ月" },
  { value: 24, label: "24ヶ月" },
  { value: 25, label: "25ヶ月" },
  { value: 36, label: "36ヶ月" },
  { value: 37, label: "37ヶ月" },
];

// ─── API Functions ────────────────────────────────────────────────────────────

export async function calculateTax(req: TaxCalcRequest): Promise<TaxCalcResult> {
  return apiFetch<TaxCalcResult>("/api/v1/tax/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}
