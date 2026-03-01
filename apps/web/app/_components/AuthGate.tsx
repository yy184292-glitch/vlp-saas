"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/api";

function safeHasToken(): boolean {
  try {
    const t = getAccessToken();
    return !!t;
  } catch {
    return false;
  }
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isLogin = useMemo(() => pathname === "/login", [pathname]);

  const [status, setStatus] = useState<"checking" | "authed" | "redirecting">("checking");

  // 連打防止
  const redirectingRef = useRef(false);

  useEffect(() => {
    // login は素通し
    if (isLogin) {
      redirectingRef.current = false;
      setStatus("authed");
      return;
    }

    const ok = safeHasToken();
    if (ok) {
      redirectingRef.current = false;
      setStatus("authed");
      return;
    }

    // tokenなし → loginへ（ただし画面は消さずに “redirecting” 表示）
    setStatus("redirecting");

    if (!redirectingRef.current) {
      redirectingRef.current = true;
      // 余計な再レンダの瞬間を避けるため、同期的にreplace
      router.replace("/login");
    }
  }, [isLogin, pathname, router]);

  if (status === "checking") {
    return <div style={{ padding: 16, color: "#666" }}>Checking auth...</div>;
  }

  if (status === "redirecting") {
    return <div style={{ padding: 16, color: "#666" }}>Redirecting to login...</div>;
  }

  return <>{children}</>;
}