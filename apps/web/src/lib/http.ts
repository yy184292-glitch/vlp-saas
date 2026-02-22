// lib/http.ts

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function isJson(res: Response): boolean {
  const type = res.headers.get("content-type");
  return type?.includes("application/json") ?? false;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(
    process.env.NEXT_PUBLIC_API_BASE_URL + path,
    {
      ...init,
      credentials: "include", // Cookie認証
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    }
  );

  let body: unknown = null;

  try {
    body = isJson(res) ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "detail" in body
        ? String((body as any).detail)
        : `HTTP ${res.status}`;

    throw new ApiError(res.status, msg, body);
  }

  return body as T;
}

export function jsonBody(v: unknown): string {
  return JSON.stringify(v);
}
