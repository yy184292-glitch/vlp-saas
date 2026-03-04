import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

export async function GET(request: NextRequest) {
  if (!API_BASE) {
    return NextResponse.json(
      { detail: "API_BASE_URL が設定されていません。Render の環境変数を確認してください。" },
      { status: 503 },
    );
  }

  const token = request.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const apiRes = await fetch(`${API_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!apiRes.ok) {
      return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
    }

    const data = await apiRes.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[/api/auth/me] error:", e);
    // API サービスが起動中 or ネットワーク障害 → 503 を返してフロント側で区別可能にする
    return NextResponse.json({ detail: "APIサービスに接続できませんでした" }, { status: 503 });
  }
}
