import type { NextConfig } from "next";

// /api/v1/* は app/api/v1/[...path]/route.ts のキャッチオール Route Handler が
// ランタイムで FastAPI にプロキシするため、ビルド時リライトは不要。
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Service Worker に正しい Content-Type と Service-Worker-Allowed を付与
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // manifest.json
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
