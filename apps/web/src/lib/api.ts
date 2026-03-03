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

/* ============================================================
   Token
============================================================ */

const ACCESS_TOKEN_KEY = "access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/* ============================================================
   Base URL
============================================================ */

function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "";

  return base.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ============================================================
   Core fetch
============================================================ */

type ApiFetchOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
};

async function safeReadJson(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  if (options.auth ?? true) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | undefined = undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!res.ok) {
    const detail = await safeReadJson(res);
    const message =
      detail?.detail ??
      detail?.message ??
      `API request failed: ${res.status}`;
    throw new ApiError({
      status: res.status,
      url,
      message,
      detail,
    });
  }

  if (res.status === 204) return undefined as unknown as T;

  return (await safeReadJson(res)) as T;
}

/* ============================================================
   Auth
============================================================ */

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  store_id?: string;
  role: string;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

/* ============================================================
   Register Owner
============================================================ */

export type RegisterOwnerPayload = {
  store: {
    name: string;
    prefecture: string;
    address1?: string;
    address2?: string;
    phone?: string;
    zip?: string;
  };
  owner: {
    name: string;
    email: string;
    password: string;
  };
};

export async function registerOwner(
  payload: RegisterOwnerPayload
): Promise<LoginResponse> {
  // ① まず店舗作成
  const store = await apiFetch<{ id: string }>("/api/v1/stores", {
    method: "POST",
    auth: false,
    body: payload.store,
  });

  // ② オーナー登録（APIが token を返す想定）
  return apiFetch<LoginResponse>("/api/v1/auth/register-owner", {
    method: "POST",
    auth: false,
    body: {
      email: payload.owner.email,
      password: payload.owner.password,
      name: payload.owner.name,
      store_id: store.id,
    },
  });
}

/* ============================================================
   Register with Invite
============================================================ */

export async function registerWithInvite(input: {
  invite_code: string;
  email: string;
  password: string;
  name: string;
}): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/register-invite", {
    method: "POST",
    auth: false,
    body: input,
  });
}

/* ============================================================
   Me
============================================================ */

export type Me = {
  id: string;
  email: string;
  store_id: string;
  role: string;
};

export async function getMe(): Promise<Me> {
  return apiFetch<Me>("/api/v1/users/me", {
    method: "GET",
    auth: true,
  });
}

/* ============================================================
   Invites
============================================================ */

export type Seats = {
  store_id: string;
  plan_code: string;
  seat_limit: number;
  active_users: number;
};

export type Invite = {
  id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
};

export async function getSeats(): Promise<Seats> {
  return apiFetch<Seats>("/api/v1/invites/seats", { method: "GET" });
}

export async function listInvites(): Promise<Invite[]> {
  return apiFetch<Invite[]>("/api/v1/invites", { method: "GET" });
}

export async function createInvite(input?: {
  role?: string;
  max_uses?: number;
  code_length?: number;
  expires_at?: string | null;
}): Promise<Invite> {
  return apiFetch<Invite>("/api/v1/invites", {
    method: "POST",
    body: {
      role: input?.role ?? "staff",
      max_uses: input?.max_uses ?? 1,
      code_length: input?.code_length ?? 10,
      expires_at: input?.expires_at ?? null,
    },
  });
}

// =====================
// Reports: By Work
// =====================

export type SalesMode = "exclusive" | "inclusive";

export type ProfitByWorkRow = {
  work_id: string;
  work_name: string;
  sales: number;
  cost: number;
  profit: number;
  margin_rate: number; // 0..1（APIが返さない場合はUI側でも算出可）
};

export type ProfitByWorkResponse = {
  date_from: string;
  date_to: string;
  rows: ProfitByWorkRow[];
};

export async function getProfitByWork(args: {
  date_from: string;
  date_to: string;
  store_id: string;
  sales_mode?: SalesMode;
}): Promise<ProfitByWorkResponse> {
  const p = new URLSearchParams();
  p.set("date_from", args.date_from);
  p.set("date_to", args.date_to);
  p.set("store_id", args.store_id);
  if (args.sales_mode) p.set("sales_mode", args.sales_mode);

  return apiFetch<ProfitByWorkResponse>(`/api/v1/reports/profit-by-work?${p.toString()}`, {
    method: "GET",
    auth: true,
  });
}
