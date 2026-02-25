"use client";

import type { ReactNode } from "react";
import ClientNav from "./ClientNav";
import AuthGate from "./AuthGate";
import CalendarPanel from "./CalendarPanel";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      {/* 上：常設ヘッダー（既存） */}
      <ClientNav />

      {/* 下：本文 + 右カレンダー */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <main
          style={{
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            minHeight: "calc(100vh - 88px)",
          }}
        >
          {children}
        </main>

        <aside>
          <CalendarPanel />
        </aside>
      </div>
    </AuthGate>
  );
}
