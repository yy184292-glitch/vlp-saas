/**
 * VLP Web API client (Next.js App Router safe)
 * - No window/localStorage access at module top-level (build/prerender safe)
 * - Token helpers for ClientNav/AuthGate
 * - Adds Authorization: Bearer <token> for authenticated API calls
 */

export type Car = {
  id: string | number;
  // Backend/legacy field name variations are kept as unknown for now.
  maker?: unknown;
  make?: unknown;
  model?: unknown;
  year?: unknown;
};

export type CreateCarInput = {
  maker: string;
  model: string;
  year?: number;
};

type LoginResponse = {
  access_token: string;
  token_type?: string;
};

const TOKEN_KEY = "vlp_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Read access token from localStorage (client-only). */
export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Save access token to localStorage (client-only). */
export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

/** Remove access token from localStorage (client-only). */
export function clearAccessToken(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) {
    // Called at runtime from client components; fail loudly so misconfig is obvious.
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base.replace(/\/$/, "");
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Merge extras (caller can override if needed)
  return { ...headers, ...(extra as any) };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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

/** Optional: login helper (if you want to centralize it) */
export async function login(email: string, password: string): Promise<void> {
  const data = await request<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!data?.access_token) throw new Error("Login response missing access_token");
  setAccessToken(data.access_token);
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
