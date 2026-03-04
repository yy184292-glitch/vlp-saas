"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/register"];

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [status, setStatus] = useState<"checking" | "authed" | "redirecting">("checking");
  const redirectingRef = useRef(false);

  useEffect(() => {
    // 公開ページは認証不要
    if (isPublic) {
      redirectingRef.current = false;
      setStatus("authed");
      return;
    }

    let cancelled = false;

    // /api/auth/me で Cookie を検証（httpOnly Cookie はサーバーサイドのみ読める）
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setStatus("authed");
        } else {
          setStatus("redirecting");
          if (!redirectingRef.current) {
            redirectingRef.current = true;
            router.replace("/login");
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("redirecting");
        if (!redirectingRef.current) {
          redirectingRef.current = true;
          router.replace("/login");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPublic, pathname, router]);

  if (status === "checking") {
    return <div style={{ padding: 16, color: "#666" }}>Checking auth...</div>;
  }

  if (status === "redirecting") {
    return <div style={{ padding: 16, color: "#666" }}>Redirecting to login...</div>;
  }

  return <>{children}</>;
}
