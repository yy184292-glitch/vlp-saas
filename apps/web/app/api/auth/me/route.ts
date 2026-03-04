import { NextRequest, NextResponse } from "next/server";

const API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

export async function GET(request: NextRequest) {
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
  } catch {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
}
