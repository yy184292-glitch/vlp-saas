"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/api";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (pathname === "/login") {
      setAuthed(true);
      setReady(true);
      return;
    }

    const token = getAccessToken();
    if (token) {
      setAuthed(true);
    } else {
      setAuthed(false);
      router.replace("/login");
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return <p style={{ padding: 16 }}>Checking auth...</p>;
  if (!authed) return null;

  return <>{children}</>;
}
