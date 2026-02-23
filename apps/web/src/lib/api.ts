// apps/web/src/lib/api.ts
/**
 * Frontend API client (single entry).
 * - apiFetch: base URL + /api/v1 prefix + Bearer token
 * - login: tries JSON first, then falls back to form-urlencoded on 422
 */

import { listCars, getCar, createCar, deleteCar } from "../features/cars/carsApi";
import type { Car, CreateCarInput } from "../features/cars/carsApi";

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
    // ignore
  }
}

export function clearAccessToken(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. e.g. https://vlp-api.onrender.com"
    );
  }
  return raw.replace(/\/$/, "");
}

function withApiPrefix(path: string): string {
  if (path.startsWith("/api/")) return path;
  const prefix = "/api/v1";
  if (path.startsWith("/")) return `${prefix}${path}`;
  return `${prefix}/${path}`;
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBaseUrl();
  return `${base}${withApiPrefix(path)}`;
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
    return await res.text();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = resolveUrl(path);
  const headers = new Headers(init.headers);

  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const payload = await safeReadPayload(res);
    throw new ApiError(`API request failed: ${res.status} ${res.statusText}`, res.status, payload);
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await safeReadPayload(res)) as T;
}

export type LoginInput = { email: string; password: string };
export type LoginResponse = { access_token: string; token_type?: string };

function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError && typeof e.status === "number";
}

export function login(email: string, password: string): Promise<LoginResponse>;
export function login(input: LoginInput): Promise<LoginResponse>;
export async function login(arg1: string | LoginInput, arg2?: string): Promise<LoginResponse> {
  const email = typeof arg1 === "string" ? arg1 : arg1.email;
  const password = typeof arg1 === "string" ? arg2 : arg1.password;

  if (!email) throw new Error("login: email is required");
  if (!password) throw new Error("login: password is required");

  const LOGIN_PATH = "/auth/login";

  // 1) JSON
  try {
    const resp = await apiFetch<LoginResponse>(LOGIN_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (resp?.access_token) setAccessToken(resp.access_token);
    return resp;
  } catch (e) {
    if (!isApiError(e) || e.status !== 422) throw e;
  }

  // 2) Form fallback
  const body = new URLSearchParams({ username: email, password }).toString();

  const resp = await apiFetch<LoginResponse>(LOGIN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (resp?.access_token) setAccessToken(resp.access_token);
  return resp;
}


// Cars API re-exports (call sites keep importing from "@/lib/api")
export { listCars, getCar, createCar, deleteCar };
export type { Car, CreateCarInput };
