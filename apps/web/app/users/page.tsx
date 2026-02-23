"use client";

import AuthGate from "../_components/AuthGate";

export default function UsersPage() {
  return (
    <AuthGate>
      <main style={{ margin: "48px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Users</h1>
        <p>管理者用のユーザー作成/一覧UIを追加していきます（次のステップ）。</p>
      </main>
    </AuthGate>
  );
}
