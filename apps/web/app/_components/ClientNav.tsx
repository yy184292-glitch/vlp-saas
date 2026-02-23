"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken, getAccessToken } from "@/lib/api";
import { useEffect, useState } from "react";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        textDecoration: "none",
        border: active ? "1px solid #111" : "1px solid transparent",
        background: active ? "#111" : "transparent",
        color: active ? "#fff" : "#111",
        fontWeight: 600,
      }}
    >
      {label}
    </Link>
  );
}

export default function ClientNav() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getAccessToken());
  }, []);

  function onLogout() {
    clearAccessToken();
    setAuthed(false);
    router.push("/login");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Link href="/" style={{ textDecoration: "none", color: "#111" }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>VLP SaaS</div>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NavLink href="/cars" label="Cars" />
          <NavLink href="/shaken" label="Shaken" />
          <NavLink href="/users" label="Users" />

          {authed ? (
            <button
              onClick={onLogout}
              style={{
                marginLeft: 6,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          ) : (
            <NavLink href="/login" label="Login" />
          )}
        </nav>
      </div>
    </header>
  );
}
