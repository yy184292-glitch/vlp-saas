import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

export async function POST(request: NextRequest) {
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

    const response = NextResponse.json(
      { user_id: data.user_id, store_id: data.store_id, role: data.role },
      { status: 200 },
    );

    // access_token を httpOnly Cookie にセット（JS から読めない）
    response.cookies.set("access_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24時間
    });

    return response;
  } catch {
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}
