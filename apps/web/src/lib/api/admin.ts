import { apiFetch } from "./core";

// ─── Types ─────────────────────────────────────────────────────────────────

export type LicensePlan = "starter" | "standard" | "pro";
export type LicenseStatus = "trial" | "active" | "expired" | "suspended";

export interface License {
  id: string;
  store_id: string;
  store_name: string;
  plan: LicensePlan;
  status: LicenseStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseCreateInput {
  store_name: string;
  admin_email: string;
  admin_name?: string;
  plan: LicensePlan;
  trial_days: number;
  notes?: string;
}

export interface LicenseCreateResult {
  license: License;
  store_id: string;
  admin_email: string;
  initial_password: string;
  message: string;
}

export interface LicenseUpdateInput {
  plan?: LicensePlan;
  status?: LicenseStatus;
  trial_ends_at?: string;
  current_period_end?: string;
  notes?: string;
}

// ─── API functions ──────────────────────────────────────────────────────────

export async function listLicenses(): Promise<License[]> {
  return apiFetch<License[]>("/api/v1/admin/licenses");
}

export async function createLicense(input: LicenseCreateInput): Promise<LicenseCreateResult> {
  return apiFetch<LicenseCreateResult>("/api/v1/admin/licenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateLicense(id: string, input: LicenseUpdateInput): Promise<License> {
  return apiFetch<License>(`/api/v1/admin/licenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function suspendLicense(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/licenses/${id}`, { method: "DELETE" });
}
