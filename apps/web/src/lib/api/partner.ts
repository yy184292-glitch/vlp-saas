import { apiFetch } from "./core";

export type PartnerRank = "silver" | "gold" | "platinum";
export type ServiceType = "own" | "partner" | null;

export interface Partner {
  id: string;
  store_id: string;
  store_name: string;
  code: string;
  name: string;
  rank: PartnerRank;
  rank_updated_at: string | null;
  loan_type: string | null;
  insurance_type: string | null;
  warranty_type: string | null;
  is_active: boolean;
  referral_count: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerCreateInput {
  store_id: string;
  name: string;
  rank?: PartnerRank;
  loan_type?: ServiceType;
  insurance_type?: ServiceType;
  warranty_type?: ServiceType;
}

export interface PartnerUpdateInput {
  name?: string;
  rank?: PartnerRank;
  loan_type?: ServiceType;
  insurance_type?: ServiceType;
  warranty_type?: ServiceType;
  is_active?: boolean;
}

export interface PartnerStats {
  partner_id: string;
  active_referrals: number;
  pending_referrals: number;
  total_discount_generated: number;
  monthly_discount: number;
}

export interface PartnerStore {
  referral_id: string;
  store_id: string;
  store_name: string;
  status: string;
  activated_at: string | null;
  created_at: string;
}

export const RANK_LABELS: Record<PartnerRank, string> = {
  silver: "シルバー",
  gold: "ゴールド",
  platinum: "プラチナ",
};

export const RANK_COLORS: Record<PartnerRank, string> = {
  silver: "#94a3b8",
  gold: "#f59e0b",
  platinum: "#7c3aed",
};

export async function listPartners(): Promise<Partner[]> {
  return apiFetch<Partner[]>("/api/v1/admin/partners");
}

export async function createPartner(input: PartnerCreateInput): Promise<Partner> {
  return apiFetch<Partner>("/api/v1/admin/partners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getPartner(id: string): Promise<Partner> {
  return apiFetch<Partner>(`/api/v1/admin/partners/${id}`);
}

export async function updatePartner(id: string, input: PartnerUpdateInput): Promise<Partner> {
  return apiFetch<Partner>(`/api/v1/admin/partners/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deletePartner(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/admin/partners/${id}`, { method: "DELETE" });
}

export async function getPartnerStores(id: string): Promise<PartnerStore[]> {
  return apiFetch<PartnerStore[]>(`/api/v1/admin/partners/${id}/stores`);
}

export async function getPartnerStats(id: string): Promise<PartnerStats> {
  return apiFetch<PartnerStats>(`/api/v1/admin/partners/${id}/stats`);
}

export async function getPartnerByCode(code: string): Promise<Partner> {
  return apiFetch<Partner>(`/api/v1/admin/partners/code/${code}`);
}
