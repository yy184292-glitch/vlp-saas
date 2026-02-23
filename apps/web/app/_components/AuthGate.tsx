"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const TOKEN_KEY = "vlp_token";

/**
 * AuthGate should never be used on /login itself.
 * It checks token ONLY in useEffect to avoid SSR/prerender crashes.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Defensive: do not gate /login
    if (pathname === "/login") {
      setAuthed(true);
      setReady(true);
      return;
    }

    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (token) {
        setAuthed(true);
      } else {
        setAuthed(false);
        router.replace("/login");
      }
    } catch {
      // If storage is blocked, treat as not authenticated
      setAuthed(false);
      router.replace("/login");
    } finally {
      setReady(true);
    }
  }, [pathname, router]);

  if (!ready) return <p style={{ padding: 16 }}>Checking auth...</p>;
  if (!authed) return null;

  return <>{children}</>;
}
