"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken, clearAccessToken } from "@/lib/api";
import { useEffect } from "react";

const MENU = [
  { title: "作業指示書", href: "/work-orders" },
  { title: "車両一覧", href: "/cars" },
  { title: "見積 / 請求書", href: "/billing" },
  { title: "売上レポート", href: "/reports" },
  { title: "各種マスタ登録", href: "/masters" },
];

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          VLP System Menu
        </h1>

        <button onClick={logout}>
          Logout
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 20,
        }}
      >
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            style={{
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 12,
              textDecoration: "none",
              color: "inherit",
              fontWeight: 600,
            }}
          >
            {m.title}
          </Link>
        ))}
      </div>
    </main>
  );
}
