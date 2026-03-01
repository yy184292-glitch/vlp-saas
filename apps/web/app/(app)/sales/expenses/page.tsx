"use client";

import * as React from "react";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ExpenseOut = {
  id: string;
  store_id: string;

  expense_date: string; // YYYY-MM-DD
  category: string;
  title: string;

  vendor: string | null;
  amount: string | number; // APIは Decimal を文字列で返す場合がある
  payment_method: string | null;
  note: string | null;

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

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonthIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function formatYen(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString()}`;
}

function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && (e as any).name === "ApiError") return (e as ApiError).message;
  if (e instanceof Error) return e.message;
  return "Error";
}

function toNumberString(input: string): string {
  // 1,234 → 1234 / 全角 → 半角 など最低限
  const s = input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/,/g, "")
    .trim();
  return s;
}

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
    reload();
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
        vendor: form.vendor.trim() ? form.vendor.trim() : null,
        amount: toNumberString(form.amount || "0"),
        payment_method: form.payment_method.trim() ? form.payment_method.trim() : null,
        note: form.note || null,
      };

      if (!payload.expense_date) throw new Error("日付を入力してください");
      if (!payload.category) throw new Error("カテゴリを入力してください");
      if (!payload.title) throw new Error("件名を入力してください");

      if (editing) {
        await apiFetch<ExpenseOut>(`/api/v1/expenses/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        await apiFetch<ExpenseOut>(`/api/v1/expenses`, {
          method: "POST",
          body: payload,
        });
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
      const ok = window.confirm(`削除しますか？\n${it.expense_date} / ${it.category} / ${it.title}`);
      if (!ok) return;

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

    // 認証ヘッダ付き fetch → Blob ダウンロード（APIはattachment）
    (async () => {
      try {
        const res = await fetch(`/api/v1/expenses/export?${qs.toString()}`, {
          headers: {
            ...(typeof window !== "undefined" && window.localStorage.getItem("access_token")
              ? { Authorization: `Bearer ${window.localStorage.getItem("access_token")}` }
              : {}),
          },
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

  const sum = React.useMemo(() => {
    const s = items.reduce((acc, it) => {
      const n = typeof it.amount === "string" ? Number(it.amount) : Number(it.amount ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
    return s;
  }, [items]);

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">経費</CardTitle>
          <CardDescription>経費の登録・一覧・期間CSV出力</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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

              <Button variant="secondary" className="bg-white/70 hover:bg-white border border-border/70" onClick={reload}>
                再読込
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={downloadCsv}>
                CSV出力（期間）
              </Button>
              <Button onClick={openCreate}>+ 経費を登録</Button>
            </div>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="rounded-xl border border-border/70 bg-white/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">日付</TableHead>
                  <TableHead className="w-[140px]">カテゴリ</TableHead>
                  <TableHead>件名</TableHead>
                  <TableHead className="w-[160px]">取引先</TableHead>
                  <TableHead className="w-[140px] text-right">金額</TableHead>
                  <TableHead className="w-[140px]">支払方法</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.expense_date}</TableCell>
                      <TableCell>{it.category}</TableCell>
                      <TableCell className="max-w-[420px] truncate">{it.title}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{it.vendor ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatYen(it.amount)}</TableCell>
                      <TableCell>{it.payment_method ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="bg-white/70 hover:bg-white border border-border/70"
                            onClick={() => openEdit(it)}
                          >
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

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <div>
              合計: <span className="font-semibold text-foreground">{formatYen(sum)}</span>（表示中）
            </div>
            <div className="flex items-center gap-2">
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
                <Button
                  variant="secondary"
                  className="bg-white/70 hover:bg-white border border-border/70"
                  onClick={reload}
                >
                  ページ更新
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Button variant="secondary" className="bg-white/70 hover:bg-white border border-border/70" onClick={() => setOpen(false)}>
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
