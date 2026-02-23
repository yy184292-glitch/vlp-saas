"use client";

import AuthGate from "../_components/AuthGate";

export default function ShakenPage() {
  return (
    <AuthGate>
      <main style={{ margin: "48px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Shaken</h1>
        <p>ここにOCRアップロードUIを追加していきます（次のステップ）。</p>
      </main>
    </AuthGate>
  );
}
