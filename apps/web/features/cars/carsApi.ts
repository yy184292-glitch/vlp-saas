// apps/web/features/cars/carsApi.ts
import { apiFetch } from "@/lib/api";

export type Car = {
  id: string;
  make?: string;
  model?: string;
  year?: number;
};

/**
 * Payload for creating a car.
 * Extend fields as your backend schema grows.
 */
export type CreateCarInput = Omit<Car, "id"> & {
  // If your API accepts additional fields, add them here.
};

export async function listCars(): Promise<Car[]> {
  return apiFetch<Car[]>("/cars", {
    method: "GET",
  });
}

export async function getCar(id: string): Promise<Car> {
  return apiFetch<Car>(`/cars/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

/**
 * Create a new car.
 * Named export so it can be imported via:
 *   import { createCar } from "@/features/cars/carsApi";
 */
export async function createCar(input: CreateCarInput): Promise<Car> {
  return apiFetch<Car>("/cars", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

/**
 * Delete a car by id.
 */
export async function deleteCar(id: string): Promise<{ ok: true } | void> {
  return apiFetch<{ ok: true } | void>(`/cars/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
