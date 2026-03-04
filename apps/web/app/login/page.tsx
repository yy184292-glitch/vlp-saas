"use client";

export const dynamic = "force-dynamic";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { login, registerOwner } from "@/lib/api";

type Mode = "login" | "signup";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup(owner + store)
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const [storeName, setStoreName] = useState("");
  const [prefecture, setPrefecture] = useState(PREFECTURES[0] ?? "東京都");
  const [zip, setZip] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [phone, setPhone] = useState("");

  // すでに認証済みなら Dashboard へ（Cookie 確認はサーバーサイド経由）
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (res.ok) router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const canSubmit = useMemo(() => {
    if (mode === "login") return email.trim() && password.trim();
    return (
      ownerName.trim() &&
      ownerEmail.trim() &&
      ownerPassword.trim().length >= 8 &&
      storeName.trim() &&
      prefecture.trim()
    );
  }, [mode, email, password, ownerName, ownerEmail, ownerPassword, storeName, prefecture]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (mode === "login") {
        // login() が /api/auth/login を呼び httpOnly Cookie をセット
        await login(email.trim(), password);
        router.replace("/dashboard");
        return;
      }

      // signup: 店舗作成 → オーナー登録 → ログイン（Cookie セット）
      await registerOwner({
        store: {
          name: storeName.trim(),
          prefecture,
          zip: zip.trim() || undefined,
          address1: address1.trim() || undefined,
          address2: address2.trim() || undefined,
          phone: phone.trim() || undefined,
        },
        owner: {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          password: ownerPassword,
        },
      });

      // 登録後にログインして Cookie をセット
      await login(ownerEmail.trim(), ownerPassword);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return <div style={{ padding: 16, color: "#666" }}>読み込み中...</div>;
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>VLP SaaS</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setMode("login")}
          disabled={busy}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "login" ? "#f3f4f6" : "white",
            cursor: "pointer",
          }}
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          disabled={busy}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: mode === "signup" ? "#f3f4f6" : "white",
            cursor: "pointer",
          }}
        >
          初回登録（店舗作成）
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", padding: 12, borderRadius: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        {mode === "login" ? (
          <>
            <label>
              メール
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoComplete="email"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoComplete="current-password"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginTop: 6 }}>店舗情報</div>
            <label>
              店舗名（必須）
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              都道府県（必須）
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              >
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              郵便番号
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              住所1
              <input
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              住所2
              <input
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              電話
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>

            <div style={{ fontWeight: 700, marginTop: 6 }}>オーナー情報</div>
            <label>
              氏名（必須）
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={busy}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              メール（必須）
              <input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                disabled={busy}
                autoComplete="email"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
            <label>
              パスワード（8文字以上推奨）
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                disabled={busy}
                autoComplete="new-password"
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={busy || !canSubmit}
          style={{
            marginTop: 6,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            opacity: busy || !canSubmit ? 0.6 : 1,
          }}
        >
          {busy ? "処理中..." : mode === "login" ? "ログイン" : "登録して開始"}
        </button>
      </form>
    </div>
  );
}
