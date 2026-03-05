"use client";

import Link from "next/link";
import * as React from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Boxes, Building2, Settings2, Users, Wrench, TrendingUp } from "lucide-react";

type HubItem = {
  title: string;
  description: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const ITEMS: HubItem[] = [
  { title: "作業マスタ", description: "作業カテゴリ・車種別時間・工賃の管理", href: "/masters/work", Icon: Wrench },
  { title: "顧客マスタ", description: "顧客情報（請求先/連絡先）の管理", href: "/masters/customers", Icon: Users },
  { title: "査定設定", description: "平均相場API/買い上限/利益条件の設定", href: "/masters/valuation", Icon: TrendingUp },
  { title: "設定", description: "税率・自動計上などの設定", href: "/masters/settings", Icon: Settings2 },
  { title: "店舗情報", description: "店舗基本情報・請求書表記・口座情報", href: "/masters/store", Icon: Building2 },
  { title: "在庫管理", description: "部材一覧・追加・入出庫（入庫は経費自動計上）", href: "/masters/inventory", Icon: Boxes },
];

export default function MastersHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">各種マスタ</div>
          <div className="text-sm text-muted-foreground">店舗ごとにデータを管理します。</div>
        </div>

        <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
          <Link href="/dashboard">トップへ戻る</Link>
        </Button>
      </div>

      <Separator />

      <div className="grid gap-5 md:grid-cols-2">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Card className="rounded-2xl border-2 bg-white/80 shadow-sm transition hover:shadow-md hover:-translate-y-[1px] active:translate-y-0">
              <CardHeader className="py-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border shadow-sm bg-slate-50">
                      <it.Icon className="h-6 w-6 text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{it.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">{it.description}</CardDescription>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 opacity-40" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
