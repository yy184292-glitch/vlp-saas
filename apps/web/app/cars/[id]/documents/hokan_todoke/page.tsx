"use client";

import React, { useEffect, useRef } from "react";

export default function Page() {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        width: "210mm",
        minHeight: "297mm",
        background: "white",
      }}
    >
      <style>{`@page { size: A4; margin: 10mm; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}`}</style>

      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          background: "white",
          borderBottom: "1px solid #eee",
          padding: "8px 12px",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong>自動車保管場所届出（帳票）</strong>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "white",
              cursor: "pointer",
            }}
          >
            印刷
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          ※ ブラウザによっては自動印刷がブロックされるため、必要なら「印刷」ボタンを押してください。
        </div>
      </div>

      <div style={{ padding: "10mm" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>自動車保管場所届出（仮）</h1>
        <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
          次工程でテンプレ（背景PDF/画像）＋項目ON/OFFに合わせてレイアウト確定します。
        </p>
      </div>
    </main>
  );
}
