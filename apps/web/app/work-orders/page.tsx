"use client";

import RequireAuth from "@/components/RequireAuth";

export default function WorkOrdersPage() {
  return (
    <RequireAuth>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>作業指示書</h1>
        <p style={{ color: "#666" }}>ここに機能を実装していきます。</p>
      </div>
    </RequireAuth>
  );
}
