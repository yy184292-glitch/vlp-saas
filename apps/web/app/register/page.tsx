"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, registerWithInvite } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // すでに認証済みなら Dashboard へ
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => { if (res.ok) router.replace("/dashboard"); })
      .catch(() => {});
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    try {
      // 招待コードでユーザー登録
      await registerWithInvite({
        invite_code: inviteCode.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });

      // 登録後にログインして httpOnly Cookie をセット
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ margin: "48px auto", padding: 16, maxWidth: 460 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>VLPsystem 登録</h1>
      <div style={{ color: "#666", marginBottom: 16 }}>店舗管理者から受け取った「招待コード」で登録してください。</div>

      {error && (
        <div
          style={{
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>招待コード</span>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={busy}
            placeholder="例: ABCD1234EF"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>氏名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

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
            autoComplete="new-password"
            type="password"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <button
          type="submit"
          disabled={busy || !inviteCode.trim() || !name.trim() || !email.trim() || !password}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {busy ? "登録中..." : "登録してダッシュボードへ"}
        </button>

        <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
          すでにアカウントがある場合は <a href="/login">ログイン</a>
        </div>
      </form>
    </main>
  );
}
