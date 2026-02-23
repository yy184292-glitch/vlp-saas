"use client";

// Prevent build-time prerender errors on platforms like Render
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, setAccessToken } from "@/lib/api";

type LoginResponse = {
  access_token: string;
  token_type?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, go to /cars
  useEffect(() => {
    const token = getAccessToken();
    if (token) router.replace("/cars");
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!base) throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");

      const res = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      const data = text ? safeJson(text) : null;

      if (!res.ok) {
        const msg =
          (data as any)?.detail ||
          (data as any)?.message ||
          `Login failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const lr = data as LoginResponse;
      if (!lr?.access_token) throw new Error("Login response missing access_token");

      setAccessToken(lr.access_token);
      router.replace("/cars");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ margin: "48px auto", padding: 16, maxWidth: 420 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Login</h1>

      {error && (
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            autoComplete="email"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="current-password"
            type="password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {busy ? "Logging in..." : "Login"}
        </button>
      </form>
    </main>
  );
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
