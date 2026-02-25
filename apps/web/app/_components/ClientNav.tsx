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
        padding: "8px 12px",
        borderRadius: 10,
        textDecoration: "none",
        border: active ? "1px solid #111" : "1px solid #ddd",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 700,
        fontSize: 13,
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

  if (!authed) return null;

  return (
    <header
      style={{
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* 左：ロゴ */}
        <Link href="/dashboard" style={{ textDecoration: "none", color: "#111" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            VLP System
          </div>
        </Link>

        {/* 中央：メニュー */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <NavLink href="/dashboard" label="メニュー" />
          <NavLink href="/work-orders" label="作業指示書" />
          <NavLink href="/cars" label="車両関係" />
          <NavLink href="/billing" label="見積 / 請求書" />
          <NavLink href="/reports" label="売上レポート" />
          <NavLink href="/masters" label="各種マスタ登録" />
        </nav>

        {/* 右：ログアウト */}
        <button
          onClick={onLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
