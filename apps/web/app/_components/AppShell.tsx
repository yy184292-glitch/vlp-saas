"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import ClientNav from "./ClientNav";
import AuthGate from "@/src/_components/AuthGuard";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <AuthGate>
      {isLogin ? null : <ClientNav />}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </AuthGate>
  );
}
