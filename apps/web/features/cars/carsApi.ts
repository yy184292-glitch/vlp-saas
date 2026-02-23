// apps/web/features/cars/carsApi.ts
import { apiFetch } from "@/lib/api";

/**
 * Car entity type used by the UI.
 * The UI currently mixes `make` and `maker` in different places.
 * To minimize changes, we support both at the type level and normalize on write.
 */
export type Car = {
  id: string;
  // Prefer `maker` (UI table uses this), but allow `make` for legacy usage.
  maker?: string;
  make?: string;
  model: string;
  year?: number;
};

/**
 * Payload for creating a car.
 * Accept both `make` and `maker` to avoid touching call sites.
 * We normalize to `maker` before sending to the API.
 */
export type CreateCarInput = {
  maker?: string;
  make?: string;
  model: string;
  year?: number;
};

function normalizeCreateCarInput(input: CreateCarInput): Omit<Car, "id"> {
  const maker = (input.maker ?? input.make ?? "").trim();
  return {
    maker,
    model: input.model,
    year: input.year,
  };
}

export async function listCars(): Promise<Car[]> {
  return apiFetch<Car[]>("/cars", { method: "GET" });
}

export async function getCar(id: string): Promise<Car> {
  return apiFetch<Car>(`/cars/${encodeURIComponent(id)}`, { method: "GET" });
}

/**
 * Create a new car.
 * Named export so it can be imported via:
 *   import { createCar } from "@/features/cars/carsApi";
 */
export async function createCar(input: CreateCarInput): Promise<Car> {
  const payload = normalizeCreateCarInput(input);

  return apiFetch<Car>("/cars", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
