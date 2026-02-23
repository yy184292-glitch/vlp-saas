"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/api";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      const next = encodeURIComponent(pathname || "/cars");
      router.replace(`/login?next=${next}`);
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <main style={{ maxWidth: 960, margin: "48px auto", padding: 16 }}>
        <p>Checking session…</p>
      </main>
    );
  }

  return <>{children}</>;
}
