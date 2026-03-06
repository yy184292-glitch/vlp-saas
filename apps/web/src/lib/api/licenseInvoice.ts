import { apiFetch } from "./core";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LicenseInvoiceType = "invoice" | "receipt";
export type InvoiceBillingCycle = "monthly" | "yearly";
export type LicenseInvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export interface LicenseInvoice {
  id: string;
  store_id: string;
  license_id: string;
  store_name: string;
  invoice_number: string;
  type: LicenseInvoiceType;
  billing_cycle: InvoiceBillingCycle;
  amount: number;
  tax_amount: number;
  total_amount: number;
  period_from: string | null;
  period_to: string | null;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  status: LicenseInvoiceStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  plan: string;
}

export interface LicenseInvoiceCreateInput {
  license_id: string;
  type?: LicenseInvoiceType;
  billing_cycle?: InvoiceBillingCycle;
  amount: number;
  period_from?: string | null;
  period_to?: string | null;
  due_date?: string | null;
  note?: string | null;
}

// プラン料金マスタ（フロント側参照用）
export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  starter:  { monthly: 9_800,  yearly: 105_840 },
  standard: { monthly: 19_800, yearly: 213_840 },
  pro:      { monthly: 29_800, yearly: 321_840 },
};

export const PLAN_LABELS: Record<string, string> = {
  starter: "スターター",
  standard: "スタンダード",
  pro: "プロ",
};

// ─── API Functions (superadmin) ──────────────────────────────────────────────

export async function listLicenseInvoices(): Promise<LicenseInvoice[]> {
  return apiFetch<LicenseInvoice[]>("/api/v1/admin/license-invoices");
}

export async function createLicenseInvoice(
  input: LicenseInvoiceCreateInput
): Promise<LicenseInvoice> {
  return apiFetch<LicenseInvoice>("/api/v1/admin/license-invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getLicenseInvoice(id: string): Promise<LicenseInvoice> {
  return apiFetch<LicenseInvoice>(`/api/v1/admin/license-invoices/${id}`);
}

export async function markInvoicePaid(id: string): Promise<LicenseInvoice> {
  return apiFetch<LicenseInvoice>(`/api/v1/admin/license-invoices/${id}/paid`, {
    method: "PUT",
  });
}

export async function cancelInvoice(id: string): Promise<LicenseInvoice> {
  return apiFetch<LicenseInvoice>(`/api/v1/admin/license-invoices/${id}/cancel`, {
    method: "PUT",
  });
}

// ─── API Functions (store — 自店舗閲覧) ─────────────────────────────────────

export async function listMyInvoices(): Promise<LicenseInvoice[]> {
  return apiFetch<LicenseInvoice[]>("/api/v1/store-invoices");
}
