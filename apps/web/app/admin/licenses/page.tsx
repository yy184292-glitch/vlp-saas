"use client";

import { useState } from "react";

type License = {
  license_key: string;
  customer_name?: string;
  customer_id?: string;
  expires_on?: string;
  revoked?: boolean;
};

async function api(path: string, body: any) {
  const res = await fetch("/api/admin" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text);
  }

  if (!res.ok) {
    throw new Error(data?.detail || "API error");
  }

  return data;
}

export default function Page() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<License[]>([]);
  const [selected, setSelected] = useState<License | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!q.trim()) return;

    try {
      setBusy(true);
      setError("");

      const res = await api("/search", { q });

      setList(res.rows || res || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function extend(days: number) {
    if (!selected) return;

    await api("/extend", {
      license_key: selected.license_key,
      days,
    });

    await search();
  }

  async function toggle() {
    if (!selected) return;

    const path = selected.revoked ? "/revive" : "/revoke";

    await api(path, {
      license_key: selected.license_key,
    });

    await search();
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>管理者ライセンス</h1>

      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="license / customer / email"
        />

        <button onClick={search} disabled={busy}>
          {busy ? "検索中..." : "検索"}
        </button>
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <table border={1} cellPadding={5}>
        <thead>
          <tr>
            <th>License</th>
            <th>Customer</th>
            <th>Expires</th>
            <th>Revoked</th>
          </tr>
        </thead>

        <tbody>
          {list.map((x) => (
            <tr
              key={x.license_key}
              onClick={() => setSelected(x)}
              style={{
                background:
                  selected?.license_key === x.license_key
                    ? "#eef"
                    : "",
                cursor: "pointer",
              }}
            >
              <td>{x.license_key}</td>
              <td>{x.customer_name}</td>
              <td>{x.expires_on}</td>
              <td>{String(x.revoked)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <h3>{selected.license_key}</h3>

          <button onClick={() => extend(30)}>
            +30日
          </button>

          <button onClick={() => extend(365)}>
            +365日
          </button>

          <button onClick={toggle}>
            {selected.revoked ? "復活" : "失効"}
          </button>
        </div>
      )}
    </div>
  );
}
