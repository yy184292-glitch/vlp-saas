"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAccessToken } from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Container } from "./layout/Container";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { applyBgGrayClass, getBgGrayFromStorage, setBgGrayToStorage } from "./UiPreferences";

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
        padding: "9px 12px",
        borderRadius: 12,
        textDecoration: "none",
        border: active ? "1px solid #111" : "2px solid #e5e7eb",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        fontWeight: 800,
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        boxShadow: active ? "0 1px 0 rgba(0,0,0,0.2)" : "0 1px 0 rgba(0,0,0,0.05)",
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
      { href: "/sales/cars", label: "車両売上・利益" },
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
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: "9px 12px",
          borderRadius: 12,
          border: active ? "1px solid #111" : "2px solid #e5e7eb",
          background: active ? "#111" : "#fff",
          color: active ? "#fff" : "#111",
          fontWeight: 800,
          fontSize: 13,
          cursor: "pointer",
          whiteSpace: "nowrap",
          boxShadow: active ? "0 1px 0 rgba(0,0,0,0.2)" : "0 1px 0 rgba(0,0,0,0.05)",
        }}
      >
        売上レポート ▾
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 220,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            padding: 8,
            zIndex: 50,
          }}
        >
          {items.map((it) => {
            const a = isActivePath(pathname, it.href, false);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 10px",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "#111",
                  background: a ? "#f3f4f6" : "transparent",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClientNav() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<string>("staff");
  const [bgGray, setBgGray] = useState(true);

  useEffect(() => {
    // デフォルト: ON（背景ライトグレー）
    try {
      const v = getBgGrayFromStorage();
      setBgGray(v);
      applyBgGrayClass(v);
    } catch {
      // ignore
    }
  }, []);

  function onToggleBgGray(v: boolean) {
    setBgGray(v);
    setBgGrayToStorage(v);
    applyBgGrayClass(v);
  }


  useEffect(() => {
    // /api/auth/me で Cookie を検証し、ロールも取得
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((me) => {
        if (me) {
          setAuthed(true);
          setRole(me.role ?? "staff");
        }
      })
      .catch(() => {});
  }, []);

  const canViewSales = role === "admin" || role === "manager" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  async function onLogout() {
    await clearAccessToken(); // httpOnly Cookie を削除
    setAuthed(false);
    router.push("/login");
  }

  if (!authed) return null;

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: "#f4f4f5" }}>
      <Container size="wide" className="px-4 py-3">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/dashboard" style={{ textDecoration: "none", color: "#111" }}>
            <div style={{ fontWeight: 950, fontSize: 18, whiteSpace: "nowrap" }}>VLP system</div>
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
              marginLeft: "auto",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 2,
            }}
          >
            <NavLink href="/dashboard" label="メニュー" exact />
            <NavLink href="/work-orders" label="作業指示書" />
            <NavLink href="/cars" label="車両一覧" />
            <NavLink href="/billing" label="見積・請求書" />
            <NavLink href="/masters" label="各種マスタ登録" />
            <NavLink href="/import" label="CSVインポート" />
            <NavLink href="/sales/expenses" label="経費一覧" />

            {canViewSales ? <ReportsMenu /> : null}
            {(role === "admin" || role === "manager") ? <NavLink href="/staff" label="スタッフ" /> : null}
            {isSuperAdmin ? <NavLink href="/admin/licenses" label="管理者" /> : null}

            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 6 }}>
              <Label style={{ fontSize: 12, fontWeight: 800 }} htmlFor="bg-gray-toggle">
                背景グレー
              </Label>
              <Switch id="bg-gray-toggle" checked={bgGray} onCheckedChange={onToggleBgGray} />
            </div>


            <button
              onClick={onLogout}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                border: "2px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                whiteSpace: "nowrap",
                marginLeft: 6,
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
}
