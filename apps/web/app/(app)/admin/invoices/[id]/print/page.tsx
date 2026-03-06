"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { getLicenseInvoice, PLAN_LABELS, type LicenseInvoice } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateJp(s: string | null | undefined): string {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtMoney(n: number): string {
  return `¥${n.toLocaleString()}`;
}

function serviceName(inv: LicenseInvoice): string {
  const plan = PLAN_LABELS[inv.plan] ?? inv.plan;
  const cycle = inv.billing_cycle === "yearly" ? "年払い（10%割引）" : "月払い";
  return `VLPシステム利用料（${plan}プラン・${cycle}）`;
}

function periodLabel(inv: LicenseInvoice): string {
  if (!inv.period_from || !inv.period_to) return "―";
  return `${fmtDateJp(inv.period_from)} 〜 ${fmtDateJp(inv.period_to)}`;
}

// 収入印紙が必要かどうか（5万円以上の受取書）
function needsStamp(inv: LicenseInvoice): boolean {
  return inv.type === "receipt" && inv.total_amount >= 50_000;
}

// ─── Print Page ───────────────────────────────────────────────────────────────

export default function InvoicePrintPage() {
  const params = useParams<{ id: string }>();
  const [inv, setInv] = React.useState<LicenseInvoice | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!params?.id) return;
    getLicenseInvoice(params.id)
      .then(setInv)
      .catch((e) => setError(e?.message ?? "読み込みに失敗しました"));
  }, [params?.id]);

  if (error) {
    return (
      <div style={{ padding: 40, color: "#ef4444", textAlign: "center" }}>
        {error}
      </div>
    );
  }
  if (!inv) {
    return (
      <div style={{ padding: 40, color: "#888", textAlign: "center" }}>
        読み込み中…
      </div>
    );
  }

  const isReceipt = inv.type === "receipt";
  const docTitle = isReceipt ? "領収書" : "請求書";

  return (
    <>
      {/* 印刷時にナビ・ボタンを非表示にするCSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
        }
        @page { size: A4 portrait; margin: 15mm; }
      `}</style>

      {/* 画面表示用ボタン */}
      <div className="no-print" style={{ padding: "16px 24px", display: "flex", gap: 12, background: "#1e1e1e", borderBottom: "1px solid #3a3a3a" }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          印刷 / PDF保存
        </button>
        <button
          onClick={() => window.history.back()}
          style={{ padding: "8px 20px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          戻る
        </button>
      </div>

      {/* A4 印刷エリア */}
      <div
        className="print-area"
        style={{
          maxWidth: 740,
          margin: "24px auto",
          padding: "48px 56px",
          background: "#fff",
          color: "#111",
          fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
          boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
          borderRadius: 4,
          minHeight: "calc(297mm - 30mm)",
          boxSizing: "border-box",
        }}
      >
        {/* タイトル */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.1em", margin: 0, borderBottom: "3px solid #111", paddingBottom: 10, display: "inline-block" }}>
            {docTitle}
          </h1>
        </div>

        {/* 番号・日付エリア */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
          <div />
          <div style={{ fontSize: 13, lineHeight: 1.9, textAlign: "right" }}>
            <div><span style={{ color: "#666" }}>書類番号：</span><strong>{inv.invoice_number}</strong></div>
            <div><span style={{ color: "#666" }}>発行日：</span>{fmtDateJp(inv.issued_at)}</div>
            {!isReceipt && inv.due_date && (
              <div><span style={{ color: "#666" }}>支払期限：</span><strong style={{ color: "#b91c1c" }}>{fmtDateJp(inv.due_date)}</strong></div>
            )}
          </div>
        </div>

        {/* 宛名 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800, borderBottom: "2px solid #111", paddingBottom: 6, marginBottom: 4 }}>
            {inv.store_name} 御中
          </div>
          {isReceipt && (
            <div style={{ fontSize: 32, fontWeight: 900, color: "#111", marginTop: 12, textAlign: "center", letterSpacing: "0.05em" }}>
              {fmtMoney(inv.total_amount)}
            </div>
          )}
          {isReceipt && (
            <div style={{ fontSize: 13, color: "#555", marginTop: 6, textAlign: "center" }}>
              但し、{inv.note ?? `VLPシステム利用料（${periodLabel(inv)}）として`} 上記正に領収いたしました。
            </div>
          )}
        </div>

        {/* 明細テーブル */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", border: "1px solid #cbd5e1", fontWeight: 700 }}>サービス内容</th>
              <th style={{ padding: "10px 12px", textAlign: "center", border: "1px solid #cbd5e1", fontWeight: 700, width: 100 }}>数量</th>
              <th style={{ padding: "10px 12px", textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 700, width: 120 }}>単価</th>
              <th style={{ padding: "10px 12px", textAlign: "right", border: "1px solid #cbd5e1", fontWeight: 700, width: 130 }}>金額（税抜）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "12px 12px", border: "1px solid #cbd5e1", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600 }}>{serviceName(inv)}</div>
                {(inv.period_from || inv.period_to) && (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                    対象期間：{periodLabel(inv)}
                  </div>
                )}
                {inv.note && (
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{inv.note}</div>
                )}
              </td>
              <td style={{ padding: "12px 12px", border: "1px solid #cbd5e1", textAlign: "center" }}>1</td>
              <td style={{ padding: "12px 12px", border: "1px solid #cbd5e1", textAlign: "right" }}>{fmtMoney(inv.amount)}</td>
              <td style={{ padding: "12px 12px", border: "1px solid #cbd5e1", textAlign: "right" }}>{fmtMoney(inv.amount)}</td>
            </tr>
          </tbody>
        </table>

        {/* 合計エリア */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
          <table style={{ width: 280, fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 12px", color: "#555" }}>小計（税抜）</td>
                <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmtMoney(inv.amount)}</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 12px", color: "#555" }}>消費税（10%）</td>
                <td style={{ padding: "6px 12px", textAlign: "right" }}>{fmtMoney(inv.tax_amount)}</td>
              </tr>
              <tr style={{ borderTop: "2px solid #111" }}>
                <td style={{ padding: "10px 12px", fontWeight: 800, fontSize: 15 }}>合計（税込）</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, fontSize: 18, color: "#111" }}>
                  {fmtMoney(inv.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 収入印紙欄（領収書・5万円以上） */}
        {needsStamp(inv) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "inline-block", border: "2px solid #111", borderRadius: 4, padding: "10px 24px", textAlign: "center", minWidth: 120 }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>収入印紙</div>
              <div style={{ height: 50, width: 100 }} />
            </div>
          </div>
        )}

        {/* 発行者情報 */}
        <div style={{ borderTop: "1px solid #ccc", paddingTop: 24, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>株式会社 VLP</div>
              <div style={{ color: "#555" }}>〒000-0000　東京都○○区○○ 1-2-3</div>
              <div style={{ color: "#555" }}>TEL: 00-0000-0000</div>
              <div style={{ color: "#555" }}>登録番号: T0000000000000</div>
            </div>

            {/* 振込先（請求書のみ） */}
            {!isReceipt && (
              <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>お振込先</div>
                <div style={{ color: "#555" }}>○○銀行　○○支店</div>
                <div style={{ color: "#555" }}>普通　1234567</div>
                <div style={{ color: "#555" }}>カ）ブイエルピー</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
