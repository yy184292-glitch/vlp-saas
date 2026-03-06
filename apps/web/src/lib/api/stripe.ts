import { apiFetch } from "./core";

export interface CheckoutSessionInput {
  plan: string;
  billing_cycle: "monthly" | "yearly";
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutSessionResult {
  url: string;
  session_id: string;
  mock?: boolean;
}

export interface PortalSessionInput {
  return_url?: string;
}

export interface PortalSessionResult {
  url: string;
  mock?: boolean;
}

export interface SubscriptionStatus {
  plan: string;
  billing_cycle: "monthly" | "yearly";
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  has_stripe: boolean;
  referral_discount: number;
  monthly_price: number;
  yearly_price: number;
  current_period_end: string | null;
}

export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSessionResult> {
  return apiFetch<CheckoutSessionResult>("/api/v1/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function createPortalSession(
  input: PortalSessionInput = {}
): Promise<PortalSessionResult> {
  return apiFetch<PortalSessionResult>("/api/v1/stripe/create-portal-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiFetch<SubscriptionStatus>("/api/v1/stripe/subscription-status");
}
