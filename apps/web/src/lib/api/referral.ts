import { apiFetch } from "./core";

export interface Referral {
  id: string;
  referrer_store_id: string;
  referrer_store_name: string;
  referred_store_id: string;
  referred_store_name: string;
  referral_code: string;
  partner_id: string | null;
  status: "pending" | "active" | "cancelled";
  activated_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface MyDiscountInfo {
  active_referrals: number;
  monthly_discount: number;
  monthly_price_before: number;
  monthly_price_after: number;
  free_slots_needed: number;
}

export interface MyCodeInfo {
  code: string;
  store_name: string;
}

export const REFERRAL_DISCOUNT_PER_ACTIVE = 1_000; // 円

export async function listReferrals(): Promise<Referral[]> {
  return apiFetch<Referral[]>("/api/v1/referrals");
}

export async function activateReferral(id: string): Promise<Referral> {
  return apiFetch<Referral>(`/api/v1/referrals/activate/${id}`, { method: "POST" });
}

export async function getMyCode(): Promise<MyCodeInfo> {
  return apiFetch<MyCodeInfo>("/api/v1/referrals/my-code");
}

export async function getMyReferrals(): Promise<Referral[]> {
  return apiFetch<Referral[]>("/api/v1/referrals/my-referrals");
}

export async function getMyDiscount(): Promise<MyDiscountInfo> {
  return apiFetch<MyDiscountInfo>("/api/v1/referrals/my-discount");
}
