"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAccessToken, getAccessToken } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { ArrowRight, BarChart3, Car, FileText, Settings2, Wrench, LogOut } from "lucide-react";

type MenuItem = {
  title: string;
  description: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const MENU: MenuItem[] = [
  {
    title: "売上レポート",
    description: "KPI（売上/原価/粗利/粗利率）を即確認。日次/作業別/部材別へドリル。",
    href: "/sales/dashboard",
    Icon: BarChart3,
    badge: "KPI",
  },
  { title: "見積 / 請求書", description: "見積作成、請求書発行、明細管理", href: "/billing", Icon: FileText },
  { title: "作業指示書", description: "作業の作成・進捗・完了までを管理", href: "/work-orders", Icon: Wrench },
  { title: "車両一覧", description: "車両の情報・状態・履歴を一覧で確認", href: "/cars", Icon: Car },
  { title: "各種マスタ登録", description: "マスタの登録・編集・整備", href: "/masters", Icon: Settings2 },
];

export default function DashboardPage() {
  const router = useRouter();

  React.useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  function logout() {
    clearAccessToken();
    router.replace("/login");
  }
  <div style={{ padding: 12, border: "3px solid red", fontWeight: 900 }}>
   DASHBOARD PAGE (app/(app)/dashboard/page.tsx) RENDERED
  </div>
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">メニュー</div>
          <div className="text-sm text-muted-foreground">
            各機能への入口。売上は「売上レポート」からKPIを確認。
          </div>
        </div>

        <Button variant="outline" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        {MENU.map((m) => (
          <Link key={m.href} href={m.href} className="block no-underline text-foreground">
            <Card className="group shadow-sm border-border/60 hover:shadow-md transition">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-background border shadow-sm">
                      <m.Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {m.title}
                        {m.badge ? <Badge variant="secondary">{m.badge}</Badge> : null}
                      </CardTitle>
                      <CardDescription className="mt-1">{m.description}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-70 transition" />
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">開く</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}