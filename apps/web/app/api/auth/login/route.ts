import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { detail: "API_BASE_URL が設定されていません。Render の環境変数を確認してください。" },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();

    const apiRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok) {
      return NextResponse.json(data, { status: apiRes.status });
    }

    if (!data.access_token) {
      return NextResponse.json({ detail: "access_token が取得できませんでした" }, { status: 502 });
    }

    const response = NextResponse.json(
      { user_id: data.user_id, store_id: data.store_id, role: data.role },
      { status: 200 },
    );

    response.cookies.set("access_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24時間
    });

    return response;
  } catch (e) {
    console.error("[/api/auth/login] error:", e);
    return NextResponse.json({ detail: "ログインサービスに接続できませんでした" }, { status: 503 });
  }
}
