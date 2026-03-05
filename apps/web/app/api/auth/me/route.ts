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

    // 401/403 → 認証失敗（ログインへ誘導してよい）
    // 5xx → サーバーエラー（認証失敗ではない。503 を返して AuthGate のリダイレクトを抑制）
    if (!apiRes.ok) {
      if (apiRes.status >= 500) {
        console.error(`[/api/auth/me] FastAPI returned ${apiRes.status}`);
        return NextResponse.json({ detail: "APIサービスが応答できませんでした" }, { status: 503 });
      }
      // 401/403: 期限切れトークンを含む Cookie をクリアしてログインへ誘導
      const res = NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
      res.cookies.set("access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
      return res;
    }

    const data = await apiRes.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[/api/auth/me] network error:", e);
    return NextResponse.json({ detail: "APIサービスに接続できませんでした" }, { status: 503 });
  }
}
