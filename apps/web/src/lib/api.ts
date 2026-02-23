// apps/web/src/lib/api.ts
/**
 * Single public API surface for the frontend.
 *
 * Pages/components import from here:
 *   import { apiFetch, login, listCars, createCar, deleteCar, type Car } from "@/lib/api";
 *
 * This file provides:
 * - apiFetch: typed fetch wrapper with sensible defaults
 * - login: OAuth2PasswordRequestForm-style login (stores token to localStorage)
 * - Re-exports for cars API helpers/types
 */

export type ApiErrorPayload = unknown;

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload: ApiErrorPayload;

  constructor(message: string, status: number, payload: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const TOKEN_STORAGE_KEY = "vlp_access_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
}

export function clearAccessToken(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Set it to e.g. https://vlp-api.onrender.com"
    );
  }
  return raw.replace(/\/$/, "");
}

function withApiPrefix(path: string): string {
  // If caller already passes /api/v1..., keep it.
  if (path.startsWith("/api/")) return path;

  // Default API prefix for this project.
  const prefix = "/api/v1";
  if (path.startsWith("/")) return `${prefix}${path}`;
  return `${prefix}/${path}`;
}

function resolveUrl(path: string): string {
  // Allow absolute URLs
  if (/^https?:\/\//i.test(path)) return path;

  const base = getApiBaseUrl();
  const p = withApiPrefix(path);
  return `${base}${p}`;
}

async function safeReadPayload(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.json();
  } catch {
    return await res.text().catch(() => null);
  }
}

/**
 * Typed fetch wrapper.
 * - Adds base URL and `/api/v1` prefix by default
 * - Adds Authorization header if a token exists
 * - Throws ApiError on non-2xx with parsed payload when possible
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = resolveUrl(path);
  const headers = new Headers(init.headers);

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const payload = await safeReadPayload(res);
    throw new ApiError(
      `API request failed: ${res.status} ${res.statusText}`,
      res.status,
      payload
    );
  }

  if (res.status === 204) return undefined as unknown as T;

  const payload = await safeReadPayload(res);
  return payload as T;
}

/** Login request payload used by the UI. */
export type LoginInput = {
  email: string;
  password: string;
};

/** Login response shape. Adjust if your backend differs. */
export type LoginResponse = {
  access_token: string;
  token_type?: string;
};

/**
 * Authenticate user and return an access token.
 *
 * Supports BOTH call styles:
 *   await login(email, password)
 *   await login({ email, password })
 *
 * Side-effect:
 * - Stores access token to localStorage (TOKEN_STORAGE_KEY).
 */
export function login(email: string, password: string): Promise<LoginResponse>;
export function login(input: LoginInput): Promise<LoginResponse>;
export async function login(
  arg1: string | LoginInput,
  arg2?: string
): Promise<LoginResponse> {
  const email = typeof arg1 === "string" ? arg1 : arg1.email;
  const password = typeof arg1 === "string" ? arg2 : arg1.password;

  if (!email) throw new Error("login: email is required");
  if (!password) throw new Error("login: password is required");

  // If your backend uses a different path, change here:
  const LOGIN_PATH = "/auth/login";

  const body = new URLSearchParams({
    // FastAPI OAuth2PasswordRequestForm expects `username` and `password`
    username: email,
    password,
  }).toString();

  const resp = await apiFetch<LoginResponse>(LOGIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (resp?.access_token) setAccessToken(resp.access_token);
  return resp;
}

// Cars API re-exports (keep call sites stable)
export {
  listCars,
  getCar,
  createCar,
  deleteCar,
  type Car,
  type CreateCarInput,
} from "@/features/cars/carsApi";
