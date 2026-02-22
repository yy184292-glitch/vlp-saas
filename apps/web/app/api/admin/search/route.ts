import { NextRequest, NextResponse } from "next/server";
import { proxyPostJson } from "../_proxy";

const ipHits = new Map<string, { t: number; n: number }>();

function getIp(req: NextRequest): string {
  // Cloudflare/Render どちらでも拾える可能性がある
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const now = Date.now();
  const w = ipHits.get(ip);

  // 2秒窓で最大3回まで（必要なら調整）
  if (!w || now - w.t > 2000) {
    ipHits.set(ip, { t: now, n: 1 });
  } else {
    w.n += 1;
    if (w.n > 3) {
      return NextResponse.json({ detail: "Too many requests. Please wait a moment." }, { status: 429 });
    }
  }

  const body = await req.json();
  return proxyPostJson("/admin/search", body);
}
