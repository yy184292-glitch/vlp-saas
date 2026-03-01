"use client";

import Link from "next/link";
import * as React from "react";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BillingKind = "estimate" | "invoice";
type BillingStatus = "draft" | "issued" | "void";

type BillingOut = {
  id: string;
  store_id: string | null;
  kind: BillingKind;
  status: BillingStatus;
  doc_no: string | null;
  customer_name: string | null;

  subtotal: number;
  tax_total: number;
  total: number;

  tax_rate: string; // APIが "0.1000" みたいな文字列で返すため
  tax_mode: string;
  tax_rounding: string;

  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

function formatYen(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "¥0";
  return `¥${Math.trunc(v).toLocaleString()}`;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && (e as any).name === "ApiError") return (e as ApiError).message;
  if (e instanceof Error) return e.message;
  return "Error";
}

export default function BillingPage() {
  const [items, setItems] = React.useState<BillingOut[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const [limit, setLimit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);

  const [kind, setKind] = React.useState<BillingKind | "">("");
  const [status, setStatus] = React.useState<BillingStatus | "">("");

  const query = React.useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    if (kind) qs.set("kind", kind);
    if (status) qs.set("status", status);
    return qs.toString();
  }, [limit, offset, kind, status]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<BillingOut[]>(`/api/v1/billing?${query}`, { method: "GET", auth: true });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function createDraft(kindToCreate: BillingKind) {
    const customer = window.prompt("顧客名（任意）") ?? "";
    try {
      await apiFetch<BillingOut>("/api/v1/billing", {
        method: "POST",
        auth: true,
        body: {
          kind: kindToCreate,
          status: "draft",
          customer_name: customer.trim() || null,
          lines: [{ name: "明細", qty: 1, unit_price: 0 }],
        },
      });
      await reload();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  }

  async function issueBilling(id: string) {
    if (!window.confirm("発行しますか？")) return;
    try {
      await apiFetch<BillingOut>(`/api/v1/billing/${encodeURIComponent(id)}/issue`, { method: "POST", auth: true });
      await reload();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  }

  async function convertEstimateToInvoice(id: string) {
    if (!window.confirm("見積 → 請求書に変換しますか？")) return;
    try {
      await apiFetch<BillingOut>(`/api/v1/billing/${encodeURIComponent(id)}/convert`, { method: "POST", auth: true });
      await reload();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  }

  async function voidInvoice(id: string) {
    const reason = window.prompt("取消理由（任意）") ?? "";
    if (!window.confirm("この請求書を取消(VOID)しますか？")) return;

    try {
      await apiFetch<BillingOut>(`/api/v1/billing/${encodeURIComponent(id)}/void`, {
        method: "POST",
        auth: true,
        body: { reason: reason.trim() || undefined },
      });
      await reload();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  }

  async function deleteDraft(id: string) {
    if (!window.confirm("削除しますか？（draftのみ推奨）")) return;
    try {
      await apiFetch<{ deleted: boolean }>(`/api/v1/billing/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
      await reload();
    } catch (e) {
      window.alert(errorMessage(e));
    }
  }

  function openPdf(id: string) {
    // apiFetch はblob対応してないのでwindow.open（Bearer必須なら後で署名URL方式にする）
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
    window.open(`${base}/api/v1/billing/${encodeURIComponent(id)}/export.pdf`, "_blank", "noopener,noreferrer");
  }

  function openCsv(id: string) {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
    window.open(`${base}/api/v1/billing/${encodeURIComponent(id)}/export.csv`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">請求・見積</div>
          <div className="text-sm text-muted-foreground">{items.length} 件</div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => createDraft("invoice")}>+ 請求書（下書き）</Button>
          <Button variant="outline" onClick={() => createDraft("estimate")}>
            + 見積（下書き）
          </Button>
          <Button variant="outline" onClick={reload} disabled={loading}>
            {loading ? "更新中…" : "更新"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">絞り込み</CardTitle>
          <CardDescription>種類・ステータス・ページング</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">kind</div>
            <Select
              value={kind || "all"}
              onValueChange={(v) => {
                setOffset(0);
                setKind(v === "all" ? "" : (v as BillingKind));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="all" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="invoice">invoice</SelectItem>
                <SelectItem value="estimate">estimate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">status</div>
            <Select
              value={status || "all"}
              onValueChange={(v) => {
                setOffset(0);
                setStatus(v === "all" ? "" : (v as BillingStatus));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="all" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="issued">issued</SelectItem>
                <SelectItem value="void">void</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">limit</div>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setOffset(0);
                setLimit(Number(v));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOffset((v) => Math.max(0, v - limit))}
              disabled={loading || offset === 0}
              className="w-full"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              onClick={() => setOffset((v) => v + limit)}
              disabled={loading || items.length < limit}
              className="w-full"
            >
              Next
            </Button>
          </div>

          <div className="text-xs text-muted-foreground md:col-span-3 lg:col-span-4">
            offset: {offset}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">No</TableHead>
                  <TableHead className="whitespace-nowrap">Kind</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Customer</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                  <TableHead className="whitespace-nowrap">Updated</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.map((d) => {
                  const canIssue = d.status === "draft";
                  const canConvert = d.kind === "estimate" && d.status !== "void";
                  const canVoid = d.kind === "invoice" && d.status === "issued";
                  const canDelete = d.status !== "issued";

                  return (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/billing/${d.id}`} className="underline">
                          {d.doc_no ?? d.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{d.kind}</TableCell>
                      <TableCell className="whitespace-nowrap">{d.status}</TableCell>
                      <TableCell className="min-w-[220px]">{d.customer_name ?? "-"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatYen(d.total)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(d.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2 flex-wrap justify-end">
                          <Button variant="outline" size="sm" onClick={() => openPdf(d.id)}>
                            PDF
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openCsv(d.id)}>
                            CSV
                          </Button>

                          <Button size="sm" onClick={() => issueBilling(d.id)} disabled={!canIssue}>
                            Issue
                          </Button>

                          <Button size="sm" onClick={() => convertEstimateToInvoice(d.id)} disabled={!canConvert}>
                            Convert
                          </Button>

                          <Button size="sm" onClick={() => voidInvoice(d.id)} disabled={!canVoid}>
                            Void
                          </Button>

                          <Button variant="destructive" size="sm" onClick={() => deleteDraft(d.id)} disabled={!canDelete}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {items.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}