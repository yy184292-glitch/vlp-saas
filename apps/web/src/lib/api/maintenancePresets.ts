// Maintenance Presets domain
import { apiFetch } from "./core";

export type MaintenancePreset = {
  id: string;
  store_id: string | null;
  name: string;
  vehicle_category: string;
  duration_minutes: number;
  labor_price: number | null;
  is_default: boolean;
  sort_order: number;
};

export type MaintenancePresetCreate = {
  name: string;
  vehicle_category: string;
  duration_minutes: number;
  labor_price?: number | null;
  sort_order?: number;
};

export type MaintenancePresetUpdate = {
  name?: string;
  vehicle_category?: string;
  duration_minutes?: number;
  labor_price?: number | null;
  sort_order?: number;
};

export async function listMaintenancePresets(vehicle_category?: string): Promise<MaintenancePreset[]> {
  const qs = vehicle_category ? `?vehicle_category=${encodeURIComponent(vehicle_category)}` : "";
  return apiFetch<MaintenancePreset[]>(`/api/v1/maintenance-presets${qs}`, { auth: true });
}

export async function listMaintenancePresetCategories(): Promise<string[]> {
  return apiFetch<string[]>("/api/v1/maintenance-presets/categories", { auth: true });
}

export async function createMaintenancePreset(input: MaintenancePresetCreate): Promise<MaintenancePreset> {
  return apiFetch<MaintenancePreset>("/api/v1/maintenance-presets", {
    method: "POST",
    auth: true,
    body: input,
  });
}

export async function updateMaintenancePreset(id: string, input: MaintenancePresetUpdate): Promise<MaintenancePreset> {
  return apiFetch<MaintenancePreset>(`/api/v1/maintenance-presets/${encodeURIComponent(id)}`, {
    method: "PUT",
    auth: true,
    body: input,
  });
}

export async function deleteMaintenancePreset(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/maintenance-presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });
}
