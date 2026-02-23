"use client";

import type { ReactNode } from "react";
import ClientNav from "./ClientNav";
import AuthGate from "./AuthGate";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <ClientNav />
      <div style={{ maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </AuthGate>
  );
}
