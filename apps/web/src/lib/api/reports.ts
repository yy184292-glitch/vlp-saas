// Reports domain
import { apiFetch } from "./core";

export type SalesMode = "exclusive" | "inclusive";

export type ProfitMonthlyRow = {
  month: string;
  sales: number;
  cost: number;
  profit: number;
};

export type ProfitMonthlyResponse = {
  date_from: string;
  date_to: string;
  rows: ProfitMonthlyRow[];
};

export type ProfitDailyRow = {
  day: string;
  sales: number;
  cost: number;
  profit: number;
};

export type ProfitDailyResponse = {
  date_from: string;
  date_to: string;
  rows: ProfitDailyRow[];
};

export type DashboardSummary = {
  date_from: string;
  date_to: string;
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number;
  issued_count: number;
  inventory_value: number;
};

export type ProfitByWorkRow = {
  work_id: string;
  work_name: string;
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number;
};

export type ProfitByWorkResponse = {
  date_from: string;
  date_to: string;
  rows: ProfitByWorkRow[];
};

export type CostByItemRow = {
  item_id: string;
  item_name: string;
  cost: number;
  quantity?: number;
};

export type CostByItemResponse = {
  date_from: string;
  date_to: string;
  rows: CostByItemRow[];
};

type ReportArgs = {
  date_from: string;
  date_to: string;
  store_id: string;
  sales_mode?: SalesMode;
};

function buildReportParams(args: ReportArgs): URLSearchParams {
  const p = new URLSearchParams();
  p.set("date_from", args.date_from);
  p.set("date_to", args.date_to);
  p.set("store_id", args.store_id);
  if (args.sales_mode) p.set("sales_mode", args.sales_mode);
  return p;
}

export async function getProfitMonthly(args: ReportArgs): Promise<ProfitMonthlyResponse> {
  return apiFetch<ProfitMonthlyResponse>(
    `/api/v1/reports/profit-monthly?${buildReportParams(args)}`,
    { method: "GET", auth: true }
  );
}

export async function getProfitDaily(args: ReportArgs): Promise<ProfitDailyResponse> {
  return apiFetch<ProfitDailyResponse>(
    `/api/v1/reports/profit-daily?${buildReportParams(args)}`,
    { method: "GET", auth: true }
  );
}

export async function getDashboardSummary(args: ReportArgs): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>(
    `/api/v1/dashboard/summary?${buildReportParams(args)}`,
    { method: "GET", auth: true }
  );
}

export async function getProfitByWork(args: ReportArgs): Promise<ProfitByWorkResponse> {
  return apiFetch<ProfitByWorkResponse>(
    `/api/v1/reports/profit-by-work?${buildReportParams(args)}`,
    { method: "GET", auth: true }
  );
}

export async function getCostByItem(args: ReportArgs): Promise<CostByItemResponse> {
  return apiFetch<CostByItemResponse>(
    `/api/v1/reports/cost-by-item?${buildReportParams(args)}`,
    { method: "GET", auth: true }
  );
}
