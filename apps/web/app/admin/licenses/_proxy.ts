import { NextResponse } from "next/server";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function baseUrl(): string {
  return mustEnv("ADMIN_API_BASE_URL").replace(/\/+$/, "");
}

function headersJson(): HeadersInit {
  return {
    Authorization: `Bearer ${mustEnv("ISSUER_ADMIN_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

export async function proxyPostJson(path: string, body: unknown) {
  const url = `${baseUrl()}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: headersJson(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();

  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {}

  if (!res.ok) {
    return NextResponse.json(
      { detail: typeof data === "object" ? data : text },
      { status: res.status }
    );
  }

  return NextResponse.json(data, { status: 200 });
}
