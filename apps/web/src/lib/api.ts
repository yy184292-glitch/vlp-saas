// apps/web/lib/api.ts
type ApiFetchOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

/**
 * Server/Client compatible fetch wrapper
 * Uses NEXT_PUBLIC_API_BASE_URL as base URL
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not set');
  }

  const url = new URL(path.startsWith('/') ? path : `/${path}`, base).toString();

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// apps/web/src/lib/api.ts
// Minimal fix: re-export cars APIs so pages importing from "@/lib/api" keep working.
// Keep your existing exports (e.g., apiFetch) and ADD the lines below.
//
// If this file already exists, merge these exports at the bottom.

export { apiFetch } from "@/lib/apiFetch"; // <-- If your apiFetch lives elsewhere, adjust this path.

// Cars API re-exports
export {
  listCars,
  getCar,
  createCar,
  deleteCar,
  type Car,
  type CreateCarInput,
} from "@/features/cars/carsApi";
