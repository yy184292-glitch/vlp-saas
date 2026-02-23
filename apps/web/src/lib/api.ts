/**
 * Minimal, SSR-safe API client for VLP Web.
 * - Never touches window/localStorage at module top-level.
 * - Adds Authorization: Bearer <token> when available.
 * - Works in Next.js App Router client components.
 */

export type Car = {
  id: string | number;
  maker?: unknown;
  make?: unknown; // legacy
  model?: unknown;
  year?: unknown;
};

export type CreateCarInput = {
  maker: string;
  model: string;
  year?: number;
};

const TOKEN_KEY = "vlp_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return { ...headers, ...(extra as any) };
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    // Throwing here is OK because these functions are called at runtime in the browser.
    // If you prefer softer failure, replace with console.warn and return "".
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: buildHeaders(init?.headers),
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (data as any)?.detail ||
      (data as any)?.message ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    (err as any).status = res.status;
    (err as any).details = data;
    throw err;
  }

  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------
// Cars API
// ---------------------------

export async function listCars(): Promise<Car[]> {
  return request<Car[]>("/api/v1/cars", { method: "GET" });
}

export async function createCar(input: CreateCarInput): Promise<Car> {
  return request<Car>("/api/v1/cars", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteCar(id: string): Promise<void> {
  await request<unknown>(`/api/v1/cars/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
