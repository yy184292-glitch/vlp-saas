"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Printer, FileText, AlertCircle, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getWorkReport,
  createInvoice,
  listInvoices,
  updateInvoice,
  type WorkReport,
  type Invoice,
  type WorkReportItem,
} from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtYen(n: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-03-05" → "2026年3月5日" */
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${y}年${Number(m)}月${Number(day)}日`;
}

/** 発行番号を生成: EST-202603-A1B2C3 / INV-202603-A1B2C3 */
function genInvoiceNo(inv: Invoice): string {
  const prefix = inv.invoice_type === "estimate" ? "EST" : "INV";
  const ym = inv.created_at.slice(0, 7).replace("-", "");
  const short = inv.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${prefix}-${ym}-${short}`;
}

function calcTotals(items: WorkReportItem[]) {
  const subtotal = items.reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.quantity),
    0
  );
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

// ─── ステータスバッジ（色分け） ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:     { label: "下書き",     cls: "bg-gray-100 text-gray-700 border-gray-300" },
    issued:    { label: "発行済",     cls: "bg-blue-100 text-blue-800 border-blue-300" },
    paid:      { label: "支払済",     cls: "bg-green-100 text-green-800 border-green-300" },
    cancelled: { label: "キャンセル", cls: "bg-red-100 text-red-800 border-red-300" },
  };
  const { label, cls } = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();

  const [report, setReport] = React.useState<WorkReport | null>(null);
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [invoiceType, setInvoiceType] = React.useState<"estimate" | "invoice">("estimate");
  const [issueDate, setIssueDate] = React.useState(todayStr());
  const [dueDate, setDueDate] = React.useState(addDays(todayStr(), 30));
  const [notes, setNotes] = React.useState("");
  const [step, setStep] = React.useState<"select" | "confirm">("select");

  React.useEffect(() => {
    (async () => {
      try {
        const [r, invList] = await Promise.all([getWorkReport(id), listInvoices(id)]);
        setReport(r);
        if (invList.length > 0) {
          const latest = invList[invList.length - 1];
          setInvoice(latest);
          setInvoiceType(latest.invoice_type as "estimate" | "invoice");
          setIssueDate(latest.issue_date);
          setDueDate(latest.due_date ?? addDays(latest.issue_date, 30));
          setNotes(latest.notes ?? "");
          setStep("confirm");
        }
      } catch {
        setError("データを取得できませんでした");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleCreate = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const { subtotal, tax, total } = calcTotals(report.items);
      const inv = await createInvoice(id, {
        invoice_type: invoiceType,
        issue_date: issueDate,
        due_date: invoiceType === "invoice" ? dueDate : null,
        subtotal,
        tax,
        total,
        notes: notes || null,
      });
      setInvoice(inv);
      setStep("confirm");
    } catch {
      setError("作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!report || !invoice) return;
    setSaving(true);
    try {
      const { subtotal, tax, total } = calcTotals(report.items);
      const inv = await updateInvoice(invoice.id, {
        invoice_type: invoiceType,
        issue_date: issueDate,
        due_date: invoiceType === "invoice" ? dueDate : null,
        subtotal,
        tax,
        total,
        notes: notes || null,
      });
      setInvoice(inv);
    } catch {
      setError("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const workItems = report?.items.filter((i) => i.item_type === "work") ?? [];
  const materialItems = report?.items.filter((i) => i.item_type === "material") ?? [];
  const { subtotal, tax, total } = report
    ? calcTotals(report.items)
    : { subtotal: 0, tax: 0, total: 0 };

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-muted-foreground text-lg">
        読み込み中...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg">{error ?? "不明なエラー"}</p>
        <Button asChild variant="outline">
          <Link href="/work-orders">作業指示書へ戻る</Link>
        </Button>
      </div>
    );
  }

  // ── Step: 書類種別選択 ────────────────────────────────────────────────────

  if (step === "select") {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={"/work-orders/" + id + "/report"}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">書類の種類を選択</h1>
        </div>

        <p className="text-muted-foreground text-base">
          発行する書類の種類を選択してください。
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setInvoiceType("estimate")}
            className={
              "rounded-2xl border-2 p-6 text-left transition-all " +
              (invoiceType === "estimate"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300")
            }
          >
            <FileText
              className={
                "h-8 w-8 mb-3 " +
                (invoiceType === "estimate" ? "text-blue-600" : "text-slate-400")
              }
            />
            <p className="text-lg font-bold">見積書</p>
            <p className="text-sm text-muted-foreground mt-1">金額の見積もりを提示</p>
          </button>
          <button
            type="button"
            onClick={() => setInvoiceType("invoice")}
            className={
              "rounded-2xl border-2 p-6 text-left transition-all " +
              (invoiceType === "invoice"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300")
            }
          >
            <FileText
              className={
                "h-8 w-8 mb-3 " +
                (invoiceType === "invoice" ? "text-blue-600" : "text-slate-400")
              }
            />
            <p className="text-lg font-bold">請求書</p>
            <p className="text-sm text-muted-foreground mt-1">支払いを請求する書類</p>
          </button>
        </div>

        <div className="space-y-4">
          {/* 発行日（カレンダーピッカー） */}
          <div>
            <label className="text-base font-medium block mb-2">発行日</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              inputMode="none"
              className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[52px]"
            />
          </div>

          {/* 支払期限（請求書のみ・カレンダーピッカー） */}
          {invoiceType === "invoice" && (
            <div>
              <label className="text-base font-medium block mb-2">支払期限</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                inputMode="none"
                className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[52px]"
              />
            </div>
          )}

          {/* 摘要 */}
          <div>
            <label className="text-base font-medium block mb-2">摘要・備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="任意で入力してください"
              className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={saving}
          className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
        >
          {saving ? "作成中..." : "確認画面へ"}
        </Button>
      </div>
    );
  }

  // ── Step: 書類確認画面 ────────────────────────────────────────────────────

  const invoiceNo = invoice ? genInvoiceNo(invoice) : "-";
  const docTitle = invoiceType === "estimate" ? "見　積　書" : "請　求　書";

  return (
    <div className="space-y-6 pb-32">
      {/* 画面ヘッダー（印刷時非表示） */}
      <div className="print:hidden flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={"/work-orders/" + id + "/report"}>
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">
            {invoiceType === "estimate" ? "見積書" : "請求書"}確認
          </h1>
        </div>
        <StatusBadge status={invoice?.status ?? "draft"} />
      </div>

      {/* ── 印刷対象書類 ── */}
      <div
        id="print-area"
        className="bg-white rounded-2xl border shadow-sm p-8 space-y-6 print:shadow-none print:border-none print:p-0 print:rounded-none"
      >
        {/* 上部: 宛名（左）・店舗情報（右） */}
        <div className="flex justify-between items-start">
          {/* 宛名 */}
          <div>
            <p className="text-xs text-slate-400 mb-1">お客様</p>
            <p className="text-xl font-bold border-b-2 border-slate-700 pb-1 min-w-[180px]">
              {report.vehicle_category ?? "　"}　御中
            </p>
          </div>
          {/* 店舗情報 */}
          <div className="text-right text-sm text-slate-600 space-y-0.5">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              <Building2 className="h-4 w-4 text-slate-500" />
              <span className="font-bold text-base text-slate-800">○○自動車整備</span>
            </div>
            <p>〒000-0000　○○県○○市○○1-2-3</p>
            <p>TEL: 000-0000-0000</p>
          </div>
        </div>

        {/* 書類タイトル */}
        <div className="text-center border-y py-4">
          <h2 className="text-4xl font-bold tracking-[0.3em]">{docTitle}</h2>
        </div>

        {/* メタ情報 */}
        <div className="flex justify-between text-sm bg-slate-50 border rounded-lg px-4 py-3">
          <div className="space-y-1">
            <div>
              <span className="text-slate-400 inline-block w-20">発行番号</span>
              <span className="font-mono font-semibold">{invoiceNo}</span>
            </div>
            <div>
              <span className="text-slate-400 inline-block w-20">件名</span>
              <span className="font-medium">{report.title ?? "整備作業"}</span>
            </div>
            {report.reported_by && (
              <div>
                <span className="text-slate-400 inline-block w-20">担当者</span>
                <span>{report.reported_by}</span>
              </div>
            )}
          </div>
          <div className="text-right space-y-1">
            <div>
              <span className="text-slate-400">発行日　</span>
              <span className="font-medium">{fmtDate(issueDate)}</span>
            </div>
            {invoiceType === "invoice" && dueDate && (
              <div>
                <span className="text-slate-400">支払期限　</span>
                <span className="font-medium">{fmtDate(dueDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 作業工賃テーブル */}
        {workItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">作業工賃</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left font-medium">作業名</th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-medium w-24">作業時間</th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-medium w-32">工賃</th>
                </tr>
              </thead>
              <tbody>
                {workItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-300 px-3 py-2">{item.item_name}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right text-slate-500">
                      {item.duration_minutes != null ? `${item.duration_minutes}分` : "-"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-medium">
                      {fmtYen(Number(item.unit_price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 部材テーブル */}
        {materialItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 mb-2">部材・部品</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 text-left font-medium">品名</th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-medium w-28">単価</th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-medium w-16">数量</th>
                  <th className="border border-slate-300 px-3 py-2 text-right font-medium w-32">小計</th>
                </tr>
              </thead>
              <tbody>
                {materialItems.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-300 px-3 py-2">{item.item_name}</td>
                    <td className="border border-slate-300 px-3 py-2 text-right text-slate-500">
                      {fmtYen(Number(item.unit_price))}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right text-slate-500">
                      {Number(item.quantity)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-medium">
                      {fmtYen(Number(item.unit_price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 合計（右下に大きく） */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1.5 border rounded-lg px-5 py-4 bg-slate-50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">小計（税抜）</span>
              <span>{fmtYen(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">消費税（10%）</span>
              <span>{fmtYen(tax)}</span>
            </div>
            <div className="border-t-2 border-slate-700 pt-2 flex justify-between items-baseline">
              <span className="font-bold text-base">合計（税込）</span>
              <span className="text-2xl font-extrabold text-blue-700">{fmtYen(total)}</span>
            </div>
          </div>
        </div>

        {/* 摘要 */}
        {notes && (
          <div className="border rounded-lg p-4 bg-slate-50">
            <p className="text-xs text-slate-400 mb-1">摘要・備考</p>
            <p className="text-sm whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </div>

      {/* アクションボタン（印刷時非表示） */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t shadow-lg">
        <div className="flex gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={() => setStep("select")}
            className="flex-1 h-14 text-base"
          >
            内容を修正
          </Button>
          {invoice && (
            <Button
              variant="outline"
              onClick={handleUpdate}
              disabled={saving}
              className="flex-1 h-14 text-base"
            >
              {saving ? "保存中..." : "更新保存"}
            </Button>
          )}
          <Button
            onClick={() => window.print()}
            className="flex-1 h-14 text-base font-bold bg-slate-700 hover:bg-slate-800 gap-2"
          >
            <Printer className="h-5 w-5" />
            印刷・PDF出力
          </Button>
        </div>
      </div>

      {/* 印刷用スタイル（A4・ナビ非表示） */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            padding: 0;
          }
          /* 縞模様・罫線を印刷に反映 */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
