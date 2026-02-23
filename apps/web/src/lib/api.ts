// apps/web/src/lib/api.ts
/**
 * Single public API surface for the frontend.
 *
 * Pages/components import from here:
 *   import { apiFetch, login, listCars, createCar, deleteCar, type Car } from "@/lib/api";
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
 * - Throws ApiError on non-2xx with parsed payload when possible
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = resolveUrl(path);
  const headers = new Headers(init.headers);

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

type LoginArgs = [email: string, password: string] | [input: LoginInput];

/**
 * Authenticate user and return an access token.
 *
 * Supports BOTH call styles to minimize code changes:
 *   await login(email, password)
 *   await login({ email, password })
 *
 * Uses x-www-form-urlencoded to match FastAPI's OAuth2PasswordRequestForm.
 */
export function login(email: string, password: string): Promise<LoginResponse>;
export function login(input: LoginInput): Promise<LoginResponse>;
export async function login(...args: LoginArgs): Promise<LoginResponse> {
  const { email, password } =
    typeof args[0] === "string"
      ? { email: args[0], password: args[1] }
      : { email: args[0].email, password: args[0].password };

  // If your backend uses a different path, change here:
  const LOGIN_PATH = "/auth/login";

  const body = new URLSearchParams({
    // FastAPI OAuth2PasswordRequestForm expects `username` and `password`
    username: email,
    password,
  }).toString();

  return apiFetch<LoginResponse>(LOGIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
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
