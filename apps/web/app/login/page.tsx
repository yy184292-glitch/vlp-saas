"use client";
export const dynamic = "force-dynamic";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();

  const nextPath = params.get("next") || "/cars";

  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ margin: "48px auto", padding: 16 }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Login</h1>

        {error && (
          <div
            style={{
              border: "1px solid #fca5a5",
              background: "#fee2e2",
              padding: 12,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              type="password"
              autoComplete="current-password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
          </label>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
