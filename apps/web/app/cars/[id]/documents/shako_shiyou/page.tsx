// app/cars/[id]/documents/shako_shiyou/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import AuthGate from "../../../../_components/AuthGate";
import type { Car } from "@/lib/api";
import { getCar } from "@/lib/api";

function v(v: string | null | undefined): string {
  return v && v.trim() ? v : "";
}

export default function DocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [car, setCar] = React.useState<Car | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCar(id)
      .then((c) => {
        if (!cancelled) setCar(c);
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message ?? "Failed to load car");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  React.useEffect(() => {
    // データが来てから印刷を開く
    if (!car) return;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [car]);

  return (
    <AuthGate>
      <main className="p-4 print:p-0">
        {err ? <div className="text-sm text-rose-600">{err}</div> : null}
        {!car ? (
          <div className="text-sm text-muted-foreground">読み込み中…</div>
        ) : (
          <div
            className="relative mx-auto bg-white text-black"
            style={
              width: "210mm",
              minHeight: "297mm",
            }
          >
            
            <div className="relative p-8 print:p-6 text-[12px] leading-6">
              <h1 className="text-lg font-bold mb-4">保管場所使用承諾証明</h1>
              <div className="grid grid-cols-2 gap-2">
                <div>車名：<span className="font-medium">{v(car.make ?? car.maker)} {v(car.model)}</span></div>
                <div>登録番号：<span className="font-medium">{v(car.carNumber)}</span></div>
                <div>車台番号：<span className="font-medium">{v(car.vin)}</span></div>
                <div>年式：<span className="font-medium">{car.year ?? ""}</span></div>
                <div>型式：<span className="font-medium">{v(car.modelCode)}</span></div>
                <div>色：<span className="font-medium">{v(car.color)}</span></div>
              </div>

              <div className="mt-8 text-xs text-muted-foreground print:text-black">
                ※ これは第1段階のテンプレートです。次工程で各書類の枠に合わせて “位置合わせ” してハンコだけの状態に仕上げます。
              </div>
            </div>
          </div>
        )}
      </main>
    </AuthGate>
  );
}
