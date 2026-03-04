"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  id: string;
};

export default function PrintClient({ id }: Props) {
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
          <strong>委任状（帳票）</strong>
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
          ※ 必要なら「印刷」ボタンを押してください（自動印刷がブロックされる場合あり）
        </div>
      </div>

      <div style={{ padding: "10mm" }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>委任状（仮）</h1>
        <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
          車両ID: {id}
        </p>
      </div>
    </main>
  );
}
