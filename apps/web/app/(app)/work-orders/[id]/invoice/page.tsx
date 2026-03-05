"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Printer, FileText, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

function fmtDate(d: string) {
  return d.replace(/-/g, "/");
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = React.useState<WorkReport | null>(null);
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Form state
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

  const handlePrint = () => {
    window.print();
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const workItems = report?.items.filter((i) => i.item_type === "work") ?? [];
  const materialItems = report?.items.filter((i) => i.item_type === "material") ?? [];
  const { subtotal, tax, total } = report ? calcTotals(report.items) : { subtotal: 0, tax: 0, total: 0 };

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
          <Link href="/work-orders">戻る</Link>
        </Button>
      </div>
    );
  }

  // ── Step: Select type ────────────────────────────────────────────────────

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
            className={"rounded-2xl border-2 p-6 text-left transition-all " + (invoiceType === "estimate" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300")}
          >
            <FileText className={"h-8 w-8 mb-3 " + (invoiceType === "estimate" ? "text-blue-600" : "text-slate-400")} />
            <p className="text-lg font-bold">見積書</p>
            <p className="text-sm text-muted-foreground mt-1">金額の見積もりを提示</p>
          </button>
          <button
            type="button"
            onClick={() => setInvoiceType("invoice")}
            className={"rounded-2xl border-2 p-6 text-left transition-all " + (invoiceType === "invoice" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300")}
          >
            <FileText className={"h-8 w-8 mb-3 " + (invoiceType === "invoice" ? "text-blue-600" : "text-slate-400")} />
            <p className="text-lg font-bold">請求書</p>
            <p className="text-sm text-muted-foreground mt-1">支払いを請求する書類</p>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-base font-medium block mb-2">発行日</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[52px]"
            />
          </div>
          {invoiceType === "invoice" && (
            <div>
              <label className="text-base font-medium block mb-2">支払期限</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[52px]"
              />
            </div>
          )}
          <div>
            <label className="text-base font-medium block mb-2">摘要</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="摘要・備考（任意）"
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

  // ── Step: Confirm ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-32">
      {/* Screen header (non-print) */}
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
        <Badge variant="secondary" className="text-base px-3 py-1">
          {invoice?.status === "issued" ? "発行済" : "下書き"}
        </Badge>
      </div>

      {/* ── Printable document ── */}
      <div id="print-area" className="bg-white rounded-2xl border shadow-sm p-6 space-y-6 print:shadow-none print:border-none print:p-0">

        {/* Document title */}
        <div className="text-center space-y-1 border-b pb-4">
          <h2 className="text-3xl font-bold tracking-wide">
            {invoiceType === "estimate" ? "見　積　書" : "請　求　書"}
          </h2>
          <div className="flex justify-between text-sm text-muted-foreground mt-3">
            <span>発行日: {fmtDate(issueDate)}</span>
            {invoiceType === "invoice" && dueDate && (
              <span>支払期限: {fmtDate(dueDate)}</span>
            )}
          </div>
        </div>

        {/* Vehicle / job info */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">件名</p>
          <p className="text-lg font-semibold">{report.title ?? "整備作業"}</p>
          {report.vehicle_category && (
            <p className="text-base text-slate-600">車種: {report.vehicle_category}</p>
          )}
          {report.reported_by && (
            <p className="text-base text-slate-600">担当: {report.reported_by}</p>
          )}
        </div>

        <Separator />

        {/* Work items */}
        {workItems.length > 0 && (
          <div>
            <h3 className="text-base font-semibold mb-3">作業工賃</h3>
            <table className="w-full text-base">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">作業名</th>
                  <th className="pb-2 font-medium text-right w-20">時間</th>
                  <th className="pb-2 font-medium text-right w-28">工賃</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.item_name}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {item.duration_minutes != null ? item.duration_minutes + "分" : "-"}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {fmtYen(Number(item.unit_price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Material items */}
        {materialItems.length > 0 && (
          <div>
            <h3 className="text-base font-semibold mb-3">部材</h3>
            <table className="w-full text-base">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">部材名</th>
                  <th className="pb-2 font-medium text-right w-24">単価</th>
                  <th className="pb-2 font-medium text-right w-16">数量</th>
                  <th className="pb-2 font-medium text-right w-28">小計</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materialItems.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2">{item.item_name}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {fmtYen(Number(item.unit_price))}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {Number(item.quantity)}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {fmtYen(Number(item.unit_price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-2 text-base">
          <div className="flex justify-between">
            <span className="text-muted-foreground">小計（税抜）</span>
            <span>{fmtYen(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">消費税（10%）</span>
            <span>{fmtYen(tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-xl font-bold">
            <span>合計（税込）</span>
            <span className="text-blue-700">{fmtYen(total)}</span>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="rounded-xl bg-slate-50 border p-4">
            <p className="text-sm text-muted-foreground mb-1">摘要</p>
            <p className="text-base whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </div>

      {/* Action buttons (non-print) */}
      <div className="print:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t shadow-lg">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setStep("select")}
            className="flex-1 h-14 text-base"
          >
            修正する
          </Button>
          <Button
            onClick={handlePrint}
            className="flex-1 h-14 text-base font-bold bg-slate-700 hover:bg-slate-800 gap-2"
          >
            <Printer className="h-5 w-5" />
            印刷 / PDF
          </Button>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
