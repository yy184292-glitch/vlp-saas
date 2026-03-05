import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!API_BASE) {
    return NextResponse.json(
      { detail: "API_BASE_URL が設定されていません。Render の環境変数を確認してください。" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const targetUrl = `${API_BASE}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  // host ヘッダーは転送しない（FastAPI が誤認識するため）
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const apiRes = await fetch(targetUrl, init);
    const body = await apiRes.text();
    return new NextResponse(body, {
      status: apiRes.status,
      headers: {
        "content-type": apiRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    console.error(`[/api/v1/*] proxy error -> ${targetUrl}:`, e);
    return NextResponse.json({ detail: "APIサービスに接続できませんでした" }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
