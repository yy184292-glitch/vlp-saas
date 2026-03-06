"use client";

import * as React from "react";
import { Paperclip } from "lucide-react";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// ─── 型定義 ──────────────────────────────────────────────────

type ExpenseOut = {
  id: string;
  store_id: string;
  expense_date: string; // YYYY-MM-DD
  category: string;
  title: string;
  vendor: string | null;
  amount: string | number;
  payment_method: string | null;
  note: string | null;
  attachment_count: number;
  created_at: string;
  updated_at: string;
};

type ExpenseListOut = {
  items: ExpenseOut[];
  total: number;
};

type ExpenseForm = {
  expense_date: string;
  category: string;
  title: string;
  vendor: string;
  amount: string;
  payment_method: string;
  note: string;
};

type AttachmentOut = {
  id: string;
  expense_id: string;
  filename: string;
  content_type: string;
  created_at: string;
  has_ocr: boolean;
};

// ─── ユーティリティ ──────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatYen(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString()}`;
}

function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && (e as ApiError).name === "ApiError") return (e as ApiError).message;
  if (e instanceof Error) return e.message;
  return "Error";
}

function toNumberString(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/,/g, "")
    .trim();
}

// カテゴリ名からカラーを決定（ハッシュベース）
const CATEGORY_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#ec4899", // pink
  "#14b8a6", // teal
];

function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

function CategoryBadge({ name }: { name: string }) {
  const color = categoryColor(name);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 700,
        color: "#fff",
        background: color,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

// ─── 月次サマリー ────────────────────────────────────────────

function MonthlySummary({ items }: { items: ExpenseOut[] }) {
  const summary = React.useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const it of items) {
      const n = Number(it.amount ?? 0);
      const safe = Number.isFinite(n) ? n : 0;
      map.set(it.category, (map.get(it.category) ?? 0) + safe);
      total += safe;
    }
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return { entries, total };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm">月次サマリー（表示期間）</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="flex flex-wrap gap-3 items-center">
          {summary.entries.map(([cat, amt]) => (
            <div key={cat} className="flex items-center gap-1.5 text-sm">
              <CategoryBadge name={cat} />
              <span className="tabular-nums text-muted-foreground">{formatYen(amt)}</span>
            </div>
          ))}
          <Separator orientation="vertical" className="h-5 hidden sm:block" />
          <div className="text-sm font-semibold">
            合計 <span className="tabular-nums">{formatYen(summary.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 領収書セル ──────────────────────────────────────────────

function ReceiptCell({ expenseId, attachmentCount }: { expenseId: string; attachmentCount: number }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<AttachmentOut[]>([]);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AttachmentOut[]>(`/api/v1/expenses/${expenseId}/attachments`);
      setAttachments(res || []);
    } catch (e) {
      setError((e as ApiError).message ?? "読込に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const upload = React.useCallback(async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const r = await fetch(`/api/v1/expenses/${expenseId}/attachments?do_ocr=true&ocr_lang=jpn%2Beng`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `Upload failed: ${r.status}`);
      }
      await load();
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [expenseId, load]);

  const download = React.useCallback(async (attachmentId: string, filename: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const r = await fetch(`/api/v1/expenses/attachments/${attachmentId}/download`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="領収書・添付"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            color: attachmentCount > 0 ? "#f59e0b" : "#555",
          }}
        >
          <Paperclip size={14} />
          {attachmentCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700 }}>{attachmentCount}</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>領収書・添付</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept="image/*" />
            <Button onClick={upload} disabled={loading}>
              アップロード（OCR）
            </Button>
            <div className="text-xs text-muted-foreground">
              画像から自動で文字を読み取ります（jpn+eng）。
            </div>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ファイル</TableHead>
                  <TableHead>OCR</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      まだ添付がありません
                    </TableCell>
                  </TableRow>
                ) : (
                  attachments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="max-w-[380px] truncate">{a.filename}</TableCell>
                      <TableCell>{a.has_ocr ? "あり" : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" onClick={() => download(a.id, a.filename)}>
                          ダウンロード
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── メインページ ────────────────────────────────────────────

export default function ExpensesPage() {
  const [items, setItems] = React.useState<ExpenseOut[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [limit, setLimit] = React.useState(50);
  const [offset, setOffset] = React.useState(0);
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [start, setStart] = React.useState(firstDayOfMonthIso());
  const [end, setEnd] = React.useState(todayIso());

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseOut | null>(null);
  const [form, setForm] = React.useState<ExpenseForm>({
    expense_date: todayIso(),
    category: "消耗品費",
    title: "",
    vendor: "",
    amount: "",
    payment_method: "",
    note: "",
  });

  const query = React.useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    if (q.trim()) qs.set("q", q.trim());
    if (category.trim()) qs.set("category", category.trim());
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    return qs.toString();
  }, [limit, offset, q, category, start, end]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<ExpenseListOut>(`/api/v1/expenses?${query}`);
      setItems(data.items ?? []);
      setTotal(Number(data.total ?? 0));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setForm({
      expense_date: todayIso(),
      category: "消耗品費",
      title: "",
      vendor: "",
      amount: "",
      payment_method: "",
      note: "",
    });
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((it: ExpenseOut) => {
    setEditing(it);
    setForm({
      expense_date: it.expense_date,
      category: it.category ?? "",
      title: it.title ?? "",
      vendor: it.vendor ?? "",
      amount: String(it.amount ?? ""),
      payment_method: it.payment_method ?? "",
      note: it.note ?? "",
    });
    setOpen(true);
  }, []);

  const submit = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        expense_date: form.expense_date,
        category: form.category.trim(),
        title: form.title.trim(),
        vendor: form.vendor.trim() || null,
        amount: toNumberString(form.amount || "0"),
        payment_method: form.payment_method.trim() || null,
        note: form.note || null,
      };
      if (!payload.expense_date) throw new Error("日付を入力してください");
      if (!payload.category) throw new Error("カテゴリを入力してください");
      if (!payload.title) throw new Error("件名を入力してください");

      if (editing) {
        await apiFetch<ExpenseOut>(`/api/v1/expenses/${editing.id}`, { method: "PUT", body: payload });
      } else {
        await apiFetch<ExpenseOut>(`/api/v1/expenses`, { method: "POST", body: payload });
      }
      setOpen(false);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [editing, form, reload]);

  const remove = React.useCallback(
    async (it: ExpenseOut) => {
      if (!window.confirm(`削除しますか？\n${it.expense_date} / ${it.category} / ${it.title}`)) return;
      setLoading(true);
      setError("");
      try {
        await apiFetch<void>(`/api/v1/expenses/${it.id}`, { method: "DELETE" });
        await reload();
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [reload]
  );

  const downloadCsv = React.useCallback(() => {
    if (!start || !end) {
      window.alert("期間（start/end）を指定してください");
      return;
    }
    const qs = new URLSearchParams();
    qs.set("start", start);
    qs.set("end", end);
    if (category.trim()) qs.set("category", category.trim());
    if (q.trim()) qs.set("q", q.trim());
    void (async () => {
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;
        const res = await fetch(`/api/v1/expenses/export?${qs.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`CSV出力に失敗しました (${res.status})`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const cd = res.headers.get("content-disposition") ?? "";
        const m = /filename="([^"]+)"/.exec(cd);
        a.download = m?.[1] ?? `expenses_${start}_${end}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [start, end, category, q]);

  return (
    <div className="space-y-4">
      {/* 月次サマリー */}
      <MonthlySummary items={items} />

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">経費</CardTitle>
          <CardDescription>経費の登録・一覧・期間CSV出力</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* フィルタ行 */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">期間（開始）</div>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">期間（終了）</div>
                <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-[160px]" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">カテゴリ</div>
                <Input
                  placeholder="例: 消耗品費"
                  list="expenseCategories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-[180px]"
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">検索</div>
                <Input
                  placeholder="件名/取引先/メモ"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-[240px]"
                />
              </div>
              <Button variant="secondary" onClick={reload}>
                再読込
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={downloadCsv}>
                CSV出力（期間）
              </Button>
              <Button onClick={openCreate}>+ 経費を登録</Button>
            </div>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          {/* テーブル */}
          <div className="rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">日付</TableHead>
                  <TableHead className="w-[150px]">カテゴリ</TableHead>
                  <TableHead>件名</TableHead>
                  <TableHead className="w-[160px]">取引先</TableHead>
                  <TableHead className="w-[120px] text-right">金額</TableHead>
                  <TableHead className="w-[130px]">支払方法</TableHead>
                  <TableHead className="w-[32px]" />
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.expense_date}</TableCell>
                      <TableCell>
                        <CategoryBadge name={it.category} />
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate">{it.title}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{it.vendor ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatYen(it.amount)}</TableCell>
                      <TableCell>{it.payment_method ?? "-"}</TableCell>
                      <TableCell>
                        <ReceiptCell expenseId={it.id} attachmentCount={it.attachment_count ?? 0} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(it)}>
                            編集
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => remove(it)}>
                            削除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ページネーション */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              件数: <span className="font-semibold text-foreground">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={200}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value || 50))}
                className="w-[100px]"
              />
              <Input
                type="number"
                min={0}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value || 0))}
                className="w-[120px]"
              />
              <Button variant="secondary" onClick={reload}>
                ページ更新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 登録・編集ダイアログ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editing ? "経費を編集" : "経費を登録"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">日付</div>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">カテゴリ</div>
              <Input
                placeholder="例: 消耗品費"
                list="expenseCategories"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">件名</div>
              <Input
                placeholder="例: オイル・消耗品購入"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">取引先</div>
              <Input
                placeholder="例: ○○商会"
                value={form.vendor}
                onChange={(e) => setForm((p) => ({ ...p, vendor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">金額（円）</div>
              <Input
                inputMode="numeric"
                placeholder="例: 12000"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">支払方法</div>
              <Input
                placeholder="例: カード"
                value={form.payment_method}
                onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">メモ</div>
              <Input
                placeholder="任意"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
          </div>
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={submit} disabled={loading}>
              {editing ? "更新" : "登録"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
