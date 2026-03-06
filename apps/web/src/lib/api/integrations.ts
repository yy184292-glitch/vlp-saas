import { apiFetch } from "./core";

export interface IntegrationSettings {
  loan_enabled: boolean;
  loan_url: string | null;
  loan_company_name: string | null;
  warranty_enabled: boolean;
  warranty_url: string | null;
  warranty_company_name: string | null;
  insurance_enabled: boolean;
  insurance_url: string | null;
  insurance_company_name: string | null;
}

export async function getIntegrations(): Promise<IntegrationSettings> {
  return apiFetch<IntegrationSettings>("/api/v1/integrations");
}

export async function updateIntegrations(input: IntegrationSettings): Promise<IntegrationSettings> {
  return apiFetch<IntegrationSettings>("/api/v1/integrations", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
