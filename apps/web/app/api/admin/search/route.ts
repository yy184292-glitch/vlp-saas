import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, { at: number; data: any }>();
const TTL_MS = 30_000;

const ipWindow = new Map<string, { at: number; n: number }>();
const IP_WINDOW_MS = 2_000;
const IP_MAX = 2;

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function baseUrl(): string {
  return mustEnv("ADMIN_API_BASE_URL").replace(/\/+$/, "");
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function keyFromBody(body: any): string {
  const q = String(body?.q ?? "").trim().toLowerCase();
  return `q=${q}`;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const now = Date.now();

  const w = ipWindow.get(ip);
  if (!w || now - w.at > IP_WINDOW_MS) {
    ipWindow.set(ip, { at: now, n: 1 });
  } else {
    w.n += 1;
    if (w.n > IP_MAX) {
      return NextResponse.json(
        { detail: "Too many requests. Please wait 2 seconds and try again." },
        { status: 429 }
      );
    }
  }

  const body = await req.json();
  const key = keyFromBody(body);

  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) {
    return NextResponse.json({ ...hit.data, _cache: true }, { status: 200 });
  }

  const url = `${baseUrl()}/admin/search`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mustEnv("ISSUER_ADMIN_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (res.status === 429) {
    // 上流からの429はUIに待機指示を返す（自動リトライしない）
    return NextResponse.json(
      { detail: "Upstream rate-limited. Wait 10–30 seconds and retry.", upstream: true },
      { status: 429 }
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { detail: data?.detail ?? data ?? `HTTP ${res.status}` },
      { status: res.status }
    );
  }

  cache.set(key, { at: now, data });
  return NextResponse.json(data, { status: 200 });
}
