"use client";

import type { ReactNode } from "react";
import ClientNav from "./ClientNav";
import AuthGate from "./AuthGate";
import CalendarPanel from "./CalendarPanel";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      {/* 上：常設ヘッダー */}
      <ClientNav />

      {/* 下：背景で階層を作る（白一色防止） */}
      <div className="min-h-[calc(100vh-56px)] bg-muted/30">
        <div className="mx-auto max-w-6xl p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] items-start">
            {/* Main */}
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-5">
                {children}
              </CardContent>
            </Card>

            {/* Right panel */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">カレンダー</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CalendarPanel />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}