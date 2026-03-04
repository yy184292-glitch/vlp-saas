"use client";

import React, { useEffect, useRef } from "react";

export default function Page() {
  const printedRef = useRef(false);

  useEffect(() => {
    // Trigger print after initial render. Browser may still require user gesture in some cases.
    if (printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <main style={{
      margin: 0,
      padding: 0,
      width: "210mm",
      minHeight: "297mm",
      background: "white"
    }}>
      <style>{`@page { size: A4; margin: 10mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }`}</style>

      <div className="no-print" style={{
        position: "sticky",
        top: 0,
        background: "white",
        borderBottom: "1px solid #eee",
        padding: "8px 12px",
        zIndex: 10
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <strong>委任状（原本）</strong>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "white",
              cursor: "pointer"
            }}
          >
            印刷
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          ※ ブラウザによっては自動印刷がブロックされるため、必要なら「印刷」ボタンを押してください。
        </div>
      </div>

      <object
        data="/forms/ininjou.pdf"
        type="application/pdf"
        width="100%"
        height="1123"
        aria-label="委任状（原本） PDF"
        style={{ display: "block" }}
      >
        <p>PDFを表示できません。 <a href="/forms/ininjou.pdf">PDFを開く</a></p>
      </object>
    </main>
  );
}
