import { apiFetch } from "./client";
import { Car, CarListQuery, CarUpsertInput } from "@/lib/schema/car";

export type CarListResponse = {
  items: Car[];
  total: number;
  page: number;
  pageSize: number;
};

function toQueryString(q: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function listCars(query: CarListQuery): Promise<CarListResponse> {
  return apiFetch<CarListResponse>(`/api/cars${toQueryString(query as any)}`, { method: "GET" });
}

export async function createCar(input: CarUpsertInput): Promise<Car> {
  return apiFetch<Car>(`/api/cars`, { method: "POST", body: JSON.stringify(input) });
}

export async function updateCar(id: string, input: CarUpsertInput): Promise<Car> {
  return apiFetch<Car>(`/api/cars/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function deleteCar(id: string): Promise<void> {
  return apiFetch<void>(`/api/cars/${encodeURIComponent(id)}`, { method: "DELETE" });
}
