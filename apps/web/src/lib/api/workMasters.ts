// Work Masters domain
import { apiFetch } from "./core";

export type WorkMasterRate = {
  id: string;
  vehicle_category: string;
  duration_minutes: number;
  price: number | null;
};

export type WorkMaster = {
  id: string;
  work_name: string;
  work_category: string;
  store_id: string | null;
  is_active: boolean;
  sort_order: number;
  rates: WorkMasterRate[];
};

export type WorkMasterForVehicle = {
  id: string;
  work_name: string;
  work_category: string;
  store_id: string | null;
  is_active: boolean;
  sort_order: number;
  duration_minutes: number;
  price: number | null;
};

export type WorkMasterRateInput = {
  vehicle_category: string;
  duration_minutes: number;
  price?: number | null;
};

export type WorkMasterCreate = {
  work_name: string;
  work_category: string;
  sort_order?: number;
  rates: WorkMasterRateInput[];
};

export type WorkMasterUpdate = {
  work_name?: string;
  work_category?: string;
  is_active?: boolean;
  sort_order?: number;
  rates?: WorkMasterRateInput[];
};

export const WORK_CATEGORIES = [
  "軽整備", "足回り", "冷却系", "重整備",
  "電装・カー用品", "故障診断", "板金・外装", "エアコン", "定期点検",
] as const;

export const VEHICLE_CATEGORIES = [
  "軽自動車", "普通乗用車小型", "普通乗用車中大型",
  "トラック小型2t以下", "トラック中型2t超3以下8t以下", "トラック大型8t超",
] as const;

export async function listWorkMasters(): Promise<WorkMaster[]> {
  return apiFetch<WorkMaster[]>("/api/v1/work-masters", { auth: true });
}

export async function getWorkMaster(id: string): Promise<WorkMaster> {
  return apiFetch<WorkMaster>("/api/v1/work-masters/" + encodeURIComponent(id), { auth: true });
}

export async function listWorkMastersByVehicle(vehicleCategory: string): Promise<WorkMasterForVehicle[]> {
  return apiFetch<WorkMasterForVehicle[]>(
    "/api/v1/work-masters/by-vehicle-category/" + encodeURIComponent(vehicleCategory),
    { auth: true }
  );
}

export async function createWorkMaster(input: WorkMasterCreate): Promise<WorkMaster> {
  return apiFetch<WorkMaster>("/api/v1/work-masters", { method: "POST", auth: true, body: input });
}

export async function updateWorkMaster(id: string, input: WorkMasterUpdate): Promise<WorkMaster> {
  return apiFetch<WorkMaster>("/api/v1/work-masters/" + encodeURIComponent(id), { method: "PUT", auth: true, body: input });
}

export async function deleteWorkMaster(id: string): Promise<void> {
  return apiFetch<void>("/api/v1/work-masters/" + encodeURIComponent(id), { method: "DELETE", auth: true });
}
