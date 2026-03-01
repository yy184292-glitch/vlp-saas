"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken, getAccessToken } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Container } from "./layout/Container";

type NavLinkProps = { href: string; label: string; exact?: boolean };

function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href, exact);

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
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

type MenuItem = { href: string; label: string };

function ReportsMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const rootHref = "/sales";
  const active = useMemo(() => isActivePath(pathname, rootHref, false), [pathname]);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const items: MenuItem[] = useMemo(
    () => [
      { href: "/sales/dashboard", label: "ダッシュボード" },
      { href: "/sales/daily", label: "日次" },
      { href: "/sales/monthly", label: "月次" },
      { href: "/sales/by-work", label: "作業別" },
      { href: "/sales/cost-by-item", label: "部材別原価" },
    ],
    []
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: active ? "1px solid #111" : "1px solid #ddd",
          background: active ? "#111" : "#fff",
          color: active ? "#fff" : "#111",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        売上レポート <span style={{ opacity: 0.8, fontSize: 11 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 220,
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            padding: 8,
            zIndex: 200,
          }}
        >
          {items.map((it) => {
            const itemActive = isActivePath(pathname, it.href, it.href === "/sales/dashboard");
            return (
              <Link
                key={it.href}
                href={it.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "#111",
                  background: itemActive ? "#f3f3f3" : "#fff",
                  fontWeight: itemActive ? 900 : 800,
                  fontSize: 13,
                }}
              >
                {it.label}
                <span style={{ opacity: 0.5 }}>→</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
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
    <header className="sticky top-0 z-50 border-b bg-white">
      {/* ★ヘッダーも Container で幅統一（レポート想定で wide） */}
      <Container size="wide" className="px-4 py-3">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 左：ロゴ */}
          <Link href="/dashboard" style={{ textDecoration: "none", color: "#111" }}>
            <div style={{ fontWeight: 900, fontSize: 16, whiteSpace: "nowrap" }}>VLP System</div>
          </Link>

          {/* 右：最初のメニュー5項目（常設）＋レポート＋Logout */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
              marginLeft: "auto",
            }}
          >
            <NavLink href="/dashboard" label="メニュー" exact />
            <NavLink href="/work-orders" label="作業指示書" />
            <NavLink href="/cars" label="車両関係" />
            <NavLink href="/billing" label="見積 / 請求書" />
            <NavLink href="/masters" label="各種マスタ登録" />
            <ReportsMenu />

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
                whiteSpace: "nowrap",
                marginLeft: 6,
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}