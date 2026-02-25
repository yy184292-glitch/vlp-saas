// apps/web/src/lib/api.ts
/* eslint-disable no-console */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly detail?: unknown;

  constructor(args: { status: number; url: string; message: string; detail?: unknown }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.url = args.url;
    this.detail = args.detail;
  }
}

// ===== Token (ClientNav 互換) =====
const ACCESS_TOKEN_KEY = "access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}

// ===== Base URL =====
// Renderの環境変数に合わせて一本化（優先順）
// - NEXT_PUBLIC_API_BASE_URL="https://vlp-api.onrender.com" のように入れておく想定
function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    "";

  // 末尾スラッシュを落として統一
  return base.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  // base が空なら相対URL（同一オリジンの /api プロキシ等）として扱う
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function safeReadJson(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

type ApiFetchOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown; // object を渡したら JSON 化
  auth?: boolean; // trueならBearer付与（デフォルトtrue）
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

/**
 * API呼び出しは必ずこれ経由。
 * - auth: trueでBearer付与
 * - body: object を渡すと JSON.stringify
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  const auth = options.auth ?? true;
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined = undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: options.signal,
    cache: options.cache,
    next: options.next,
  });

  if (!res.ok) {
    const detail = await safeReadJson(res);
    // 401でトークン不整合の場合はここで消すかは方針次第。事故減目的なら消してログイン誘導でもOK。
    // if (res.status === 401) clearAccessToken();
    throw new ApiError({
      status: res.status,
      url,
      message: `API request failed: ${res.status} ${res.statusText}`,
      detail,
    });
  }

  // 204 No Content 対応
  if (res.status === 204) return undefined as unknown as T;

  const json = (await safeReadJson(res)) as T;
  return json;
}

// ===== Domain: Cars =====
export type Car = {
  id: string;

  stockNo: string | null;
  status: string | null;

  make: string | null;
  maker: string | null;
  model: string | null;
  grade: string | null;

  year: number | null;
  mileage: number | null;

  carNumber: string | null;
  vin: string | null;
  modelCode: string | null;
  color: string | null;

  expectedBuyPrice: number | null;
  expectedSellPrice: number | null;
  expectedProfit: number | null;
  expectedProfitRate: number | null;
  valuationAt: string | null;

  createdAt: string | null;
  updatedAt: string | null;
};

export type CarInput = {
  stock_no?: string | null;
  status?: string | null;

  make?: string | null;
  maker?: string | null;
  model?: string | null;
  grade?: string | null;

  year?: number | null;
  mileage?: number | null;

  car_number?: string | null;
  vin?: string | null;
  model_code?: string | null;
  color?: string | null;
};

type CarsListResponse = {
  items: unknown[];
  meta: { limit: number; offset: number; total: number };
};

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// APIのレスポンス形が多少ブレてもUIを安定させる（事故減）
export function normalizeCar(raw: unknown): Car {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    id: toNullableString(r.id) ?? "",

    stockNo: toNullableString(r.stock_no ?? r.stockNo),
    status: toNullableString(r.status),

    make: toNullableString(r.make),
    maker: toNullableString(r.maker),
    model: toNullableString(r.model),
    grade: toNullableString(r.grade),

    year: toNullableNumber(r.year),
    mileage: toNullableNumber(r.mileage),

    carNumber: toNullableString(r.car_number ?? r.carNumber),
    vin: toNullableString(r.vin),
    modelCode: toNullableString(r.model_code ?? r.modelCode),
    color: toNullableString(r.color),

    expectedBuyPrice: toNullableNumber(r.expected_buy_price ?? r.expectedBuyPrice),
    expectedSellPrice: toNullableNumber(r.expected_sell_price ?? r.expectedSellPrice),
    expectedProfit: toNullableNumber(r.expected_profit ?? r.expectedProfit),
    expectedProfitRate: toNullableNumber(r.expected_profit_rate ?? r.expectedProfitRate),
    valuationAt: toNullableString(r.valuation_at ?? r.valuationAt),

    createdAt: toNullableString(r.created_at ?? r.createdAt),
    updatedAt: toNullableString(r.updated_at ?? r.updatedAt),
  };
}

export async function listCars(args?: { limit?: number; offset?: number }): Promise<{
  items: Car[];
  meta: { limit: number; offset: number; total: number };
}> {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;

  const data = await apiFetch<CarsListResponse>(`/api/v1/cars?limit=${limit}&offset=${offset}`, {
    method: "GET",
    auth: true,
  });

  const items = Array.isArray(data?.items) ? data.items.map(normalizeCar).filter((c) => c.id) : [];
  return { items, meta: data.meta };
}

export async function createCar(input: CarInput): Promise<Car> {
  const data = await apiFetch<unknown>("/api/v1/cars", { method: "POST", body: input, auth: true });
  return normalizeCar(data);
}

export async function deleteCar(id: string): Promise<void> {
  if (!id) return;
  await apiFetch<void>(`/api/v1/cars/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

export async function getCar(carId: string): Promise<Car> {
  const data = await apiFetch<unknown>(`/api/v1/cars/${encodeURIComponent(carId)}`, {
    method: "GET",
    auth: true,
  });
  return normalizeCar(data);
}

export type LoginResponse = {
  access_token: string;
  token_type?: string;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  // ログインは token 無しで叩くので auth: false
  const data = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });

  if (!data?.access_token) {
    throw new ApiError({
      status: 500,
      url: buildUrl("/api/v1/auth/login"),
      message: "Login response missing access_token",
      detail: data,
    });
  }
  return data;
}

// ===== Domain: Valuations =====
export type CarValuation = {
  id: string;
  carId: string;
  storeId: string;

  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitRate: number;

  valuationAt: string;
  createdAt: string;
};

type CarValuationsListResponse = {
  items: unknown[];
  meta: { limit: number; offset: number; total: number };
};

function normalizeValuation(raw: unknown): CarValuation {
  const r = (raw ?? {}) as Record<string, unknown>;

  return {
    id: String(r.id),
    carId: String(r.car_id),
    storeId: String(r.store_id),

    buyPrice: Number(r.buy_price),
    sellPrice: Number(r.sell_price),
    profit: Number(r.profit),
    profitRate: Number(r.profit_rate),

    valuationAt: String(r.valuation_at),
    createdAt: String(r.created_at),
  };
}

export async function listCarValuations(
  carId: string,
  args?: { limit?: number; offset?: number }
): Promise<CarValuation[]> {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;

  const data = await apiFetch<CarValuationsListResponse>(
    `/api/v1/cars/${encodeURIComponent(carId)}/valuations?limit=${limit}&offset=${offset}`,
    { method: "GET", auth: true }
  );

  return Array.isArray(data.items) ? data.items.map(normalizeValuation) : [];
}


// ============================
// Valuation Calculate API
// ============================

export type ValuationCalculateRequest = {
  make: string
  model: string
  grade: string
  year: number
  mileage: number
}

export type ValuationCalculateResult = {
  marketLow: number
  marketMedian: number
  marketHigh: number
  buyCapPrice: number
  recommendedPrice: number
  expectedProfit: number
  expectedProfitRate: number
}

function normalizeCalculateResult(raw: any): ValuationCalculateResult {
  return {
    marketLow: Number(raw?.market_low ?? 0),
    marketMedian: Number(raw?.market_median ?? 0),
    marketHigh: Number(raw?.market_high ?? 0),
    buyCapPrice: Number(raw?.buy_cap_price ?? 0),
    recommendedPrice: Number(raw?.recommended_price ?? 0),
    expectedProfit: Number(raw?.expected_profit ?? 0),
    expectedProfitRate: Number(raw?.expected_profit_rate ?? 0),
  }
}

export async function calculateValuation(
  token: string,
  payload: ValuationCalculateRequest
): Promise<ValuationCalculateResult> {
  const res = await apiFetch<any>("/api/v1/valuation/calculate", {
    method: "POST",
    token,
    body: payload,
  })
  return normalizeCalculateResult(res)
}
