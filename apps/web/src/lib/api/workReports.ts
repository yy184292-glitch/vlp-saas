import { apiFetch } from "./core";

export type WorkReportItemType = "work" | "material";
export type WorkReportStatus = "in_progress" | "completed";
export type InvoiceType = "estimate" | "invoice";
export type InvoiceStatus = "draft" | "issued";

export interface WorkReportItem {
  id: string;
  report_id: string;
  work_master_id: string | null;
  item_name: string;
  item_type: WorkReportItemType;
  quantity: number;
  unit_price: number;
  duration_minutes: number | null;
  is_checked: boolean;
  checked_at: string | null;
  memo: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkReport {
  id: string;
  instruction_id: string | null;
  car_id: string | null;
  store_id: string;
  title: string | null;
  vehicle_category: string | null;
  status: WorkReportStatus;
  completed_at: string | null;
  reported_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: WorkReportItem[];
}

export interface Invoice {
  id: string;
  report_id: string;
  invoice_type: InvoiceType;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkReportItemCreate {
  work_master_id?: string | null;
  item_name: string;
  item_type?: WorkReportItemType;
  quantity?: number;
  unit_price?: number;
  duration_minutes?: number | null;
  memo?: string | null;
  sort_order?: number;
}

export interface WorkReportItemUpdate {
  item_name?: string;
  item_type?: WorkReportItemType;
  quantity?: number;
  unit_price?: number;
  duration_minutes?: number | null;
  is_checked?: boolean;
  memo?: string | null;
  sort_order?: number;
}

export interface WorkReportCreate {
  instruction_id?: string | null;
  car_id?: string | null;
  title?: string | null;
  vehicle_category?: string | null;
  notes?: string | null;
  items?: WorkReportItemCreate[];
}

export interface WorkReportUpdate {
  title?: string | null;
  vehicle_category?: string | null;
  status?: WorkReportStatus;
  reported_by?: string | null;
  notes?: string | null;
}

export interface InvoiceCreate {
  invoice_type?: InvoiceType;
  issue_date: string;
  due_date?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
}

export interface InvoiceUpdate {
  invoice_type?: InvoiceType;
  issue_date?: string;
  due_date?: string | null;
  subtotal?: number;
  tax?: number;
  total?: number;
  notes?: string | null;
  status?: InvoiceStatus;
}

// ── WorkReports ──

export async function listWorkReports(params?: {
  car_id?: string;
  instruction_id?: string;
  status?: WorkReportStatus;
}): Promise<WorkReport[]> {
  const q = new URLSearchParams();
  if (params?.car_id) q.set("car_id", params.car_id);
  if (params?.instruction_id) q.set("instruction_id", params.instruction_id);
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetch<WorkReport[]>(`/api/v1/work-reports${qs ? "?" + qs : ""}`);
}

export async function createWorkReport(input: WorkReportCreate): Promise<WorkReport> {
  return apiFetch<WorkReport>("/api/v1/work-reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getWorkReport(id: string): Promise<WorkReport> {
  return apiFetch<WorkReport>(`/api/v1/work-reports/${id}`);
}

export async function updateWorkReport(id: string, input: WorkReportUpdate): Promise<WorkReport> {
  return apiFetch<WorkReport>(`/api/v1/work-reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function completeWorkReport(
  id: string,
  input: { reported_by?: string; notes?: string }
): Promise<WorkReport> {
  return apiFetch<WorkReport>(`/api/v1/work-reports/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteWorkReport(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/work-reports/${id}`, { method: "DELETE" });
}

// ── Items ──

export async function addWorkReportItem(
  reportId: string,
  input: WorkReportItemCreate
): Promise<WorkReportItem> {
  return apiFetch<WorkReportItem>(`/api/v1/work-reports/${reportId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateWorkReportItem(
  reportId: string,
  itemId: string,
  input: WorkReportItemUpdate
): Promise<WorkReportItem> {
  return apiFetch<WorkReportItem>(`/api/v1/work-reports/${reportId}/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteWorkReportItem(reportId: string, itemId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/work-reports/${reportId}/items/${itemId}`, { method: "DELETE" });
}

// ── Invoices ──

export async function listInvoices(reportId: string): Promise<Invoice[]> {
  return apiFetch<Invoice[]>(`/api/v1/work-reports/${reportId}/invoices`);
}

export async function createInvoice(reportId: string, input: InvoiceCreate): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/v1/work-reports/${reportId}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateInvoice(invoiceId: string, input: InvoiceUpdate): Promise<Invoice> {
  return apiFetch<Invoice>(`/api/v1/work-reports/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
