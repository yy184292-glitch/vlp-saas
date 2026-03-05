import { apiFetch } from "./core";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MonthKpi {
  count: number;
  sales: number;
  profit: number;
  profit_rate: number;
}

export interface SalesSummary {
  year: number;
  month: number;
  this_month: MonthKpi;
  prev_month: MonthKpi;
  inventory_count: number;
  negotiating_count: number;
}

export interface SalesMonthlyRow {
  year: number;
  month: number;
  count: number;
  sales: number;
  profit: number;
  profit_rate: number;
}

export interface SalesMonthly {
  year: number;
  rows: SalesMonthlyRow[];
}

export interface SalesByCarRow {
  car_id: string;
  stock_no: string;
  make: string;
  model: string;
  status: string;
  buy_price: number | null;
  sell_price: number | null;
  profit: number | null;
  profit_rate: number | null;
  staff_name: string | null;
  sold_at: string;
}

export interface SalesByCar {
  year: number;
  month: number;
  rows: SalesByCarRow[];
}

export interface SalesByStaffRow {
  user_id: string;
  staff_name: string;
  count: number;
  total_sales: number;
  total_profit: number;
  avg_profit_rate: number;
}

export interface SalesByStaff {
  year: number;
  month: number;
  rows: SalesByStaffRow[];
}

export interface InventoryStats {
  total_count: number;
  total_cost: number;
  negotiating_count: number;
}

// ─── API functions ──────────────────────────────────────────────────────────

export async function getSalesSummary(year: number, month: number): Promise<SalesSummary> {
  return apiFetch<SalesSummary>(`/api/v1/sales/summary?year=${year}&month=${month}`);
}

export async function getSalesMonthly(year: number): Promise<SalesMonthly> {
  return apiFetch<SalesMonthly>(`/api/v1/sales/monthly?year=${year}`);
}

export async function getSalesByCar(year: number, month: number): Promise<SalesByCar> {
  return apiFetch<SalesByCar>(`/api/v1/sales/by-car?year=${year}&month=${month}`);
}

export async function getSalesByStaff(year: number, month: number): Promise<SalesByStaff> {
  return apiFetch<SalesByStaff>(`/api/v1/sales/by-staff?year=${year}&month=${month}`);
}

export async function getInventoryStats(): Promise<InventoryStats> {
  return apiFetch<InventoryStats>(`/api/v1/sales/inventory-stats`);
}
