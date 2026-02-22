"use client";

import { Separator } from "@/components/ui/separator";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 bg-background">
      <div className="flex h-14 items-center px-4 md:px-6">
        <div className="text-sm text-muted-foreground">業務UIテンプレート（EXE風）</div>
      </div>
      <Separator />
    </header>
  );
}
