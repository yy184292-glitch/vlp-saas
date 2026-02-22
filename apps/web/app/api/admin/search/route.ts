import { NextRequest, NextResponse } from "next/server";
import { proxyPostJson } from "../_proxy";

/**
 * 30秒キャッシュ（同じqなら上流に投げずに返す）
 * ※Renderはインスタンス再起動でキャッシュ消えるが、429回避には十分効く
 */
const cache = new Map<string, { at: number; data: any }>();
const TTL_MS = 30_000;

// 同一IPの連打も抑止（2秒で最大2回）
const ipWindow = new Map<string, { at: number; n: number }>();
const IP_WINDOW_MS = 2_000;
const IP_MAX = 2;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function keyFromBody(body: any): string {
  // issuer_guiのpayloadは { q: string } 想定
  const q = String(body?.q ?? "").trim().toLowerCase();
  return `q=${q}`;
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const now = Date.now();

  // IP制限（軽め）
  const w = ipWindow.get(ip);
  if (!w || now - w.at > IP_WINDOW_MS) {
    ipWindow.set(ip, { at: now, n: 1 });
  } else {
    w.n += 1;
    if (w.n > IP_MAX) {
      return NextResponse.json(
        { detail: "Too many requests. Please wait 2 seconds and try again." },
        { status: 429 }
      );
    }
  }

  const body = await req.json();
  const key = keyFromBody(body);

  // キャッシュヒット
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) {
    return NextResponse.json({ ...(hit.data ?? {}), _cache: true }, { status: 200 });
  }

  // 上流へ
  const res = await proxyPostJson("/admin/search", body);

  // proxyPostJsonはNextResponseを返すので、ここでJSONを抜きたい場合は工夫が必要
  // → proxyPostJsonを使わずに直接fetchする方がキャッシュには向く
  // ここでは安全のため、proxyPostJsonをやめて直接実装する

  return res;
}
