"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ReportItem = {
  title: string;
  description: string;
  href: string;
};

const REPORTS: ReportItem[] = [
  {
    title: "ダッシュボード",
    description: "売上・原価・利益の概要",
    href: "/sales/dashboard",
  },
  {
    title: "月次レポート",
    description: "月ごとの売上・利益推移",
    href: "/sales/monthly",
  },
  {
    title: "日次レポート",
    description: "日ごとの売上・利益推移",
    href: "/sales/daily",
  },
  {
    title: "作業別利益",
    description: "作業項目ごとの利益分析",
    href: "/sales/by-work",
  },
  {
    title: "部品・材料コスト",
    description: "部品・材料ごとのコスト分析",
    href: "/sales/cost-by-item",
  },
];

export default function ReportsPage() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="text-xl font-semibold tracking-tight">
          レポート
        </div>
        <div className="text-sm text-muted-foreground">
          売上・利益・コストの分析
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.href} className="hover:bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {r.title}
              </CardTitle>
              <CardDescription>
                {r.description}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Button
                className="w-full"
                onClick={() => router.push(r.href)}
              >
                開く
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}