"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/register"];
// 503 が返ってきた場合に自動リトライするまでの間隔 (ms)
const RETRY_INTERVAL_MS = 4000;

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const [status, setStatus] = useState<"checking" | "authed" | "redirecting" | "unavailable">("checking");
  const redirectingRef = useRef(false);

  const checkAuth = useCallback((cancelled: { value: boolean }) => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (cancelled.value) return;
        if (res.ok) {
          setStatus("authed");
        } else if (res.status === 503) {
          // API コールドスタート / サーバーエラー → ログインへ飛ばさず待機してリトライ
          setStatus("unavailable");
        } else {
          // 401/403 → 未認証。ログインへリダイレクト
          setStatus("redirecting");
          if (!redirectingRef.current) {
            redirectingRef.current = true;
            routerRef.current.replace("/login");
          }
        }
      })
      .catch(() => {
        if (cancelled.value) return;
        // ネットワークエラーもサーバー到達不能と同様に扱う
        setStatus("unavailable");
      });
  }, []);

  useEffect(() => {
    // 公開ページは認証不要
    if (isPublic) {
      redirectingRef.current = false;
      setStatus("authed");
      return;
    }

    setStatus("checking");
    const cancelled = { value: false };
    checkAuth(cancelled);

    return () => { cancelled.value = true; };
  }, [isPublic, pathname, checkAuth]);

  // unavailable 状態のとき一定間隔でリトライ
  useEffect(() => {
    if (status !== "unavailable") return;
    const cancelled = { value: false };
    const timer = setTimeout(() => {
      if (!cancelled.value) {
        setStatus("checking");
        checkAuth(cancelled);
      }
    }, RETRY_INTERVAL_MS);
    return () => {
      cancelled.value = true;
      clearTimeout(timer);
    };
  }, [status, checkAuth]);

  if (status === "checking") {
    return <div style={{ padding: 16, color: "#666" }}>認証確認中...</div>;
  }

  if (status === "unavailable") {
    return <div style={{ padding: 16, color: "#666" }}>APIサービスに接続中... しばらくお待ちください。</div>;
  }

  if (status === "redirecting") {
    return <div style={{ padding: 16, color: "#666" }}>ログインページへ移動中...</div>;
  }

  return <>{children}</>;
}
