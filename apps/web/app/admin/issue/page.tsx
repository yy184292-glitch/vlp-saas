'use client';

import { useMemo, useState } from 'react';

type IssueResponse = {
  ok: boolean;
  license_key?: string;
  expires_at?: string;
  message?: string;
};

function isValidEmail(email: string): boolean {
  // シンプル検証（厳密すぎない）
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AdminIssuePage() {
  const [email, setEmail] = useState('');
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssueResponse | null>(null);

  const canSubmit = useMemo(() => {
    const d = Number(days);
    return isValidEmail(email) && Number.isFinite(d) && d >= 1 && d <= 3650 && !loading;
  }, [email, days, loading]);

  async function issue() {
    setResult(null);

    const d = Number(days);
    if (!isValidEmail(email)) {
      alert('メール形式が不正');
      return;
    }
    if (!Number.isFinite(d) || d < 1 || d > 3650) {
      alert('日数は 1〜3650 で指定');
      return;
    }

    try {
      setLoading(true);

      const res = await fetch('/api/admin/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          days: d,
          note: note.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as IssueResponse;

      if (!res.ok) {
        setResult({
          ok: false,
          message: data?.message || `発行失敗 (${res.status})`,
        });
        return;
      }

      setResult({
        ok: true,
        license_key: data.license_key,
        expires_at: data.expires_at,
        message: data.message,
      });
    } catch (e) {
      console.error(e);
      setResult({ ok: false, message: '通信エラー' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <h1>License Issue</h1>

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Duration (days)
          <input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            placeholder="30"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 12, opacity: 0.8 }}>1〜3650</div>
        </label>

        <label>
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="admin memo..."
            rows={3}
            style={{ width: '100%' }}
          />
        </label>

        <button onClick={issue} disabled={!canSubmit}>
          {loading ? 'Issuing...' : 'Issue License'}
        </button>

        {result && (
          <div style={{ padding: 12, border: '1px solid #ddd' }}>
            <div>
              Status: <b>{result.ok ? 'OK' : 'NG'}</b>
            </div>
            {result.message && <div>{result.message}</div>}
            {result.license_key && (
              <div style={{ marginTop: 8 }}>
                License Key: <code>{result.license_key}</code>
              </div>
            )}
            {result.expires_at && <div>Expires: {result.expires_at}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
