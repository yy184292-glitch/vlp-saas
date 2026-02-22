"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("string");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password); // localStorageへ保存される
      router.push("/cars");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Login</h1>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Error</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error}</pre>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            type="password"
            autoComplete="current-password"
          />
        </label>

        <button type="submit" disabled={loading || !email || !password}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p style={{ marginTop: 12, opacity: 0.8 }}>
        ログイン成功後、<code>localStorage["access_token"]</code> を保存して /cars に移動します。
      </p>
    </main>
  );
}
