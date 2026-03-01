"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAccessToken, getAccessToken, getMe } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import {
  ArrowRight,
  Car,
  FileText,
  Settings2,
  Wrench,
  BarChart3,
  ReceiptJapaneseYen,
  LogOut,
} from "lucide-react";

type MenuItem = {
  title: string;
  description: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  accentBorderClass: string;
  iconBgClass: string;
  iconClass: string;
  requireSalesPermission?: boolean;
};

const MENU: MenuItem[] = [
  {
    title: "作業指示書",
    description: "作業の作成・進捗・完了までを管理",
    href: "/work-orders",
    Icon: Wrench,
    accentBorderClass: "border-l-emerald-500",
    iconBgClass: "bg-emerald-50",
    iconClass: "text-emerald-700",
  },
  {
    title: "車両一覧",
    description: "車両の情報・状態・履歴を一覧で確認",
    href: "/cars",
    Icon: Car,
    accentBorderClass: "border-l-indigo-500",
    iconBgClass: "bg-indigo-50",
    iconClass: "text-indigo-700",
  },
  {
    title: "見積・請求書",
    description: "見積作成、請求書発行、明細管理",
    href: "/billing",
    Icon: FileText,
    accentBorderClass: "border-l-sky-500",
    iconBgClass: "bg-sky-50",
    iconClass: "text-sky-700",
  },
  {
    title: "各種マスタ登録",
    description: "マスタの登録・編集・整備",
    href: "/masters",
    Icon: Settings2,
    accentBorderClass: "border-l-slate-500",
    iconBgClass: "bg-slate-50",
    iconClass: "text-slate-700",
  },
  {
    title: "売上レポート",
    description: "KPI・売上・原価・粗利などの分析",
    href: "/sales/dashboard",
    Icon: BarChart3,
    badge: "KPI",
    accentBorderClass: "border-l-violet-500",
    iconBgClass: "bg-violet-50",
    iconClass: "text-violet-700",
    requireSalesPermission: true,
  },
  {
    title: "経費一覧",
    description: "経費の登録・一覧・CSV出力",
    href: "/sales/expenses",
    Icon: ReceiptJapaneseYen,
    badge: "+1",
    accentBorderClass: "border-l-amber-500",
    iconBgClass: "bg-amber-50",
    iconClass: "text-amber-700",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [role, setRole] = React.useState<string>("staff");

  React.useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    getMe()
      .then((me) => setRole(me.role))
      .catch(() => setRole("staff"));
  }, [router]);

  const canViewSales = role === "admin" || role === "manager";
  const visibleMenu = React.useMemo(() => {
    return MENU.filter((m) => !m.requireSalesPermission || canViewSales);
  }, [canViewSales]);

  const logout = React.useCallback(() => {
    clearAccessToken();
    router.replace("/login");
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-2xl font-semibold tracking-tight">メニュー</div>

        <Button
          variant="outline"
          onClick={logout}
          className="bg-white/70 hover:bg-white border-border/70 shadow-sm"
        >
          <LogOut className="w-4 h-4 mr-2" />
          ログアウト
        </Button>
      </div>

      <Separator />

      <div className="grid gap-5 md:grid-cols-2">
        {visibleMenu.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Card
              className={[
                "rounded-2xl border-2 bg-white/80 shadow-sm transition",
                "hover:shadow-md hover:-translate-y-[1px] active:translate-y-0",
                "border-l-8",
                m.accentBorderClass,
              ].join(" ")}
            >
              <CardHeader className="py-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div
                      className={[
                        "grid h-12 w-12 place-items-center rounded-2xl border shadow-sm",
                        m.iconBgClass,
                      ].join(" ")}
                    >
                      <m.Icon className={["h-6 w-6", m.iconClass].join(" ")} />
                    </div>

                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {m.title}
                        {m.badge ? <Badge variant="secondary">{m.badge}</Badge> : null}
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed">{m.description}</CardDescription>
                    </div>
                  </div>

                  <ArrowRight className="h-5 w-5 opacity-40 transition" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
