"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";

const MENU = [
  { title: "作業指示書", desc: "作業の作成・進捗管理", href: "/work-orders" },
  { title: "車両関係", desc: "車両一覧・査定・履歴", href: "/cars" },
  { title: "見積/請求書", desc: "見積作成・請求管理", href: "/billing" },
  { title: "売上レポート", desc: "期間別・担当別の集計", href: "/reports" },
  { title: "各種マスタ登録", desc: "店舗・顧客・商品など", href: "/masters" },
];

export default function DashboardPage() {
  return (
    <RequireAuth>
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>メニュー</h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              style={{
                display: "block",
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>{m.title}</div>
              <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>{m.desc}</div>
              <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>→ 開く</div>
            </Link>
          ))}
        </div>
      </div>
    </RequireAuth>
  );
}
