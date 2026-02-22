'use client';

import { useState } from 'react';

type License = {
  key: string;
  email: string;
  status: string;
  expires_at: string;
};

export default function AdminLicensesPage() {
  const [query, setQuery] = useState('');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);
  const API = process.env.NEXT_PUBLIC_APP_URL;

  async function search() {
    try {
      setLoading(true);

      const res = await fetch('/api/admin/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      setLicenses(data.licenses || []);
    } catch (err) {
      console.error(err);
      alert('検索失敗');
    } finally {
      setLoading(false);
    }
  }

  async function action(type: string, key: string) {
    try {
      const res = await fetch(`/api/admin/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (!res.ok) throw new Error(type + ' failed');

      await search();
    } catch (err) {
      console.error(err);
      alert(type + '失敗');
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>License Admin</h1>

      <div style={{ marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="email or license key"
        />

        <button onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <table border={1} cellPadding={10}>
        <thead>
          <tr>
            <th>Key</th>
            <th>Email</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {licenses.map((lic) => (
            <tr key={lic.key}>
              <td>{lic.key}</td>
              <td>{lic.email}</td>
              <td>{lic.status}</td>
              <td>{lic.expires_at}</td>
              <td>
                <button onClick={() => action('extend', lic.key)}>
                  Extend
                </button>

                <button onClick={() => action('revoke', lic.key)}>
                  Revoke
                </button>

                <button onClick={() => action('revive', lic.key)}>
                  Revive
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
