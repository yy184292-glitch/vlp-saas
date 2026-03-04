import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAllowedOrigins(): string[] {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(appUrl ? [appUrl] : []),
  ];
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // /api/v1/* のみ処理（リライト先 = FastAPI プロキシ）
  if (!pathname.startsWith("/api/v1/")) {
    return NextResponse.next();
  }

  // CSRF チェック: 変更系メソッドは Origin を検証
  if (MUTATION_METHODS.has(method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      const allowed = getAllowedOrigins();
      if (!allowed.includes(origin.replace(/\/+$/, ""))) {
        return new NextResponse(
          JSON.stringify({ detail: "CSRF check failed" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }
  }

  // httpOnly Cookie から Authorization ヘッダーを注入
  const token = request.cookies.get("access_token")?.value;
  if (token) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Authorization", `Bearer ${token}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
