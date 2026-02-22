// src/features/cars/carsApi.ts
import { apiFetch } from "@/lib/api";

export type Car = {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year: string;
  created_at: string;
};

export type CarCreate = {
  make: string;
  model: string;
  year: number;
};

export async function listCars(): Promise<Car[]> {
  return apiFetch<Car[]>("/cars");
}

export async function createCar(input: CarCreate): Promise<Car> {
  return apiFetch<Car>("/cars", { method: "POST", body: input });
}

export async function deleteCar(carId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/cars/${carId}`, { method: "DELETE" });
}
