import type { NextConfig } from "next";

// /api/v1/* は app/api/v1/[...path]/route.ts のキャッチオール Route Handler が
// ランタイムで FastAPI にプロキシするため、ビルド時リライトは不要。
const nextConfig: NextConfig = {};

export default nextConfig;
