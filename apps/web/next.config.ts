import type { NextConfig } from "next";

// サーバーサイドのみ使用（NEXT_PUBLIC_ は next.config.ts でも参照可）
const apiBase = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  ""
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiBase) return [];
    return [
      {
        // ブラウザの /api/v1/* を FastAPI に透過プロキシ
        // middleware.ts がCookieからAuthorizationヘッダーを注入
        source: "/api/v1/:path*",
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
