"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/api";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  // 連打防止
  const redirectingRef = useRef(false);

  useEffect(() => {
    // /login は必ず素通し（ここでナビ連打しない）
    if (pathname === "/login") {
      redirectingRef.current = false;
      setAuthed(true);
      setReady(true);
      return;
    }

    const token = getAccessToken();

    if (token) {
      redirectingRef.current = false;
      setAuthed(true);
      setReady(true);
      return;
    }

    // tokenなし → /login へ。ただし1回だけ
    setAuthed(false);
    setReady(true);

    if (!redirectingRef.current) {
      redirectingRef.current = true;
      router.replace("/login");
    }
  }, [pathname, router]);

  if (!ready) return <p style={{ padding: 16 }}>Checking auth...</p>;
  if (!authed) return null;

  return <>{children}</>;
}
