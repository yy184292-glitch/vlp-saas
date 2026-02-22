"use client";

import * as React from "react";

type Toast = { title: string; description?: string; variant?: "default" | "destructive" };

const listeners = new Set<(t: Toast | null) => void>();

export function toast(t: Toast) {
  for (const l of listeners) l(t);
  // 3秒で消す
  setTimeout(() => {
    for (const l of listeners) l(null);
  }, 3000);
}

export function Toaster() {
  const [t, setT] = React.useState<Toast | null>(null);

  React.useEffect(() => {
    listeners.add(setT);
    return () => {
      listeners.delete(setT);
    };
  }, []);

  if (!t) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] rounded-xl border bg-background p-4 shadow">
      <div className="text-sm font-semibold">{t.title}</div>
      {t.description ? <div className="mt-1 text-sm text-muted-foreground">{t.description}</div> : null}
      {t.variant === "destructive" ? <div className="mt-2 text-xs text-destructive">ERROR</div> : null}
    </div>
  );
}
