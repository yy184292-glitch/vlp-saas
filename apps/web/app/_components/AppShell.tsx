"use client";

import type { ReactNode } from "react";
import ClientNav from "./ClientNav";
import AuthGate from "./AuthGate";
import CalendarPanel from "./CalendarPanel";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, type ContainerSize } from "./layout/Container";

export default function AppShell({
  children,
  container = "narrow",
  showCalendar = true,
}: {
  children: ReactNode;
  container?: ContainerSize;

  /**
   * 右カレンダーの表示切り替え
   * - 見積/売上/作業指示書: true（デフォルト）
   * - 車両一覧/各種マスタ: false
   */
  showCalendar?: boolean;
}) {
  return (
    <AuthGate>
      {/* 上：常設ヘッダー */}
      <ClientNav />

      {/* 下：背景で階層を作る（白一色防止） */}
      <div className="min-h-[calc(100vh-56px)] bg-muted/30">
        <Container size={container} className="p-4">
          <div
            className={
              showCalendar
                ? "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] items-start"
                : "grid grid-cols-1 gap-4 items-start"
            }
          >
            {/* Main */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5">{children}</CardContent>
            </Card>

            {/* Right panel */}
            {showCalendar ? (
              <Card className="shadow-sm border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">カレンダー</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CalendarPanel />
                </CardContent>
              </Card>
            ) : null}
          </div>
        </Container>
      </div>
    </AuthGate>
  );
}