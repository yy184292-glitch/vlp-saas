import { ApiError } from "./errors";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function getBaseUrl() {
  // クライアントでは NEXT_PUBLIC_API_BASE_URL を優先、未指定なら同一オリジン
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

async function safeReadJson(res: Response): Promise<Json | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return null;
  try {
    return (await res.json()) as Json;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? 15000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${getBaseUrl()}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await safeReadJson(res);
      const message =
        (body && typeof body === "object" && "message" in body && typeof (body as any).message === "string"
          ? (body as any).message
          : `Request failed: ${res.status} ${res.statusText}`);

      const code =
        body && typeof body === "object" && "code" in body && typeof (body as any).code === "string"
          ? (body as any).code
          : undefined;

      throw new ApiError(message, { status: res.status, code, details: body });
    }

    // 204 no content
    if (res.status === 204) return undefined as T;

    const data = (await res.json()) as T;
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("Request timeout", { status: 408 });
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}
