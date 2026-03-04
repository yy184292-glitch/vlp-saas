// Core API utilities: error types, fetch wrapper
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

// ===== Token management =====
// JWT は httpOnly Cookie に移行済み（Next.js プロキシ経由）

/** @deprecated httpOnly Cookie に移行済み。常に null を返す */
export function getAccessToken(): string | null {
  return null;
}

/** @deprecated httpOnly Cookie に移行済み。/api/auth/login ルートが Cookie をセット */
export function setAccessToken(_token: string): void {
  // no-op
}

/** httpOnly Cookie を削除する（非同期）*/
export async function clearAccessToken(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
}

// ===== URL builder =====
// ブラウザからのAPIコールは Next.js プロキシ経由（相対URL）
export function buildUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
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

function extractFastApiErrorMessage(detail: unknown): string | null {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    const d = obj.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      const first = d[0] as any;
      if (first && typeof first === "object" && typeof first.msg === "string") return first.msg;
      try { return JSON.stringify(d); } catch { return "Validation error"; }
    }
    for (const key of ["message", "error", "msg"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

export type ApiFetchOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const url = buildUrl(path);

  const headers: Record<string, string> = { ...(options.headers ?? {}) };

  // auth オプションは後方互換のため残すが実質 no-op
  // Authorization ヘッダーは middleware.ts が httpOnly Cookie から注入する

  let body: BodyInit | undefined = undefined;
  if (options.body !== undefined) {
    if (typeof FormData !== "undefined" && options.body instanceof FormData) {
      body = options.body;
    } else {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }
  }

  const res = await fetch(url, { method, headers, body, signal: options.signal, cache: options.cache, next: options.next });

  if (!res.ok) {
    const detail = await safeReadJson(res);
    const friendly = extractFastApiErrorMessage(detail);
    throw new ApiError({
      status: res.status,
      url,
      message: friendly ? friendly : `API request failed: ${res.status} ${res.statusText}`,
      detail,
    });
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await safeReadJson(res)) as T;
}
