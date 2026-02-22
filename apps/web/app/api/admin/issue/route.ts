import { NextResponse } from 'next/server';

type IssueRequest = {
  email: string;
  days: number;
  note?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  const base = process.env.ADMIN_API_BASE_URL;
  const token = process.env.ISSUER_ADMIN_TOKEN;

  if (!base) return jsonError('ADMIN_API_BASE_URL is not set', 500);
  if (!token) return jsonError('ISSUER_ADMIN_TOKEN is not set', 500);

  let body: IssueRequest;
  try {
    body = (await req.json()) as IssueRequest;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const email = (body.email || '').trim().toLowerCase();
  const days = Number(body.days);

  if (!isValidEmail(email)) return jsonError('Invalid email', 400);
  if (!Number.isFinite(days) || days < 1 || days > 3650) return jsonError('Invalid days', 400);

  // NOTE:
  // ここのパスは実際の「発行」エンドポイントに合わせて調整する。
  // 例: /admin/issue, /licenses/issue, /issue など
  const url = new URL('/admin/issue', base);

  try {
    const upstream = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email,
        days,
        note: body.note || undefined,
      }),
      // タイムアウトは標準fetchだと直接はないので、必要なら AbortController を追加
    });

    const text = await upstream.text();
    const maybeJson = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: maybeJson?.message || `Upstream error (${upstream.status})`,
          upstream_status: upstream.status,
        },
        { status: 502 },
      );
    }

    // upstreamの返却形式が不明なので、素直に透過
    return NextResponse.json(maybeJson ?? { ok: true, raw: text }, { status: 200 });
  } catch (e) {
    console.error(e);
    return jsonError('Failed to reach issuer service', 502);
  }
}
