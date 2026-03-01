"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

type Customer = {
  id: string;
  store_id: string;

  name: string;
  name_kana?: string | null;
  honorific?: string | null;

  tel?: string | null;
  email?: string | null;

  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;

  contact_person?: string | null;

  invoice_number?: string | null;
  payment_terms?: string | null;

  created_at: string;
  updated_at: string;
};

type CustomerCreateIn = {
  name: string;
  name_kana?: string | null;
  honorific?: string | null;
  tel?: string | null;
  email?: string | null;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  contact_person?: string | null;
  invoice_number?: string | null;
  payment_terms?: string | null;
};

export default function CustomersMasterPage() {
  const [rows, setRows] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CustomerCreateIn>({ name: "", honorific: "様" });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<Customer[]>("/api/v1/customers");
      setRows(res || []);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = React.useCallback(async () => {
    if (!form.name.trim()) {
      setError("顧客名を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch<Customer>("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", honorific: "様" });
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form, load]);

  const remove = React.useCallback(
    async (id: string) => {
      if (!confirm("削除しますか？")) return;
      setLoading(true);
      setError(null);
      try {
        await apiFetch<{ deleted: boolean }>(`/api/v1/customers/${id}`, { method: "DELETE" });
        await load();
      } catch (e) {
        const ae = e as ApiError;
        setError(ae.message ?? "削除に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [load],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">顧客マスタ</div>
          <div className="text-sm text-muted-foreground">見積・請求で選択する顧客情報を管理します。</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
            <Link href="/masters">各種マスタへ戻る</Link>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">顧客追加</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>顧客追加</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>顧客名</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>電話</Label>
                  <Input value={form.tel ?? ""} onChange={(e) => setForm((p) => ({ ...p, tel: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>メール</Label>
                  <Input value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>住所</Label>
                  <Input
                    placeholder="住所1"
                    value={form.address1 ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))}
                    className="bg-white"
                  />
                  <Input
                    placeholder="住所2"
                    value={form.address2 ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))}
                    className="bg-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>担当者</Label>
                  <Input value={form.contact_person ?? ""} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>敬称</Label>
                  <Input value={form.honorific ?? "様"} onChange={(e) => setForm((p) => ({ ...p, honorific: e.target.value }))} className="bg-white" />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => setOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={create} disabled={loading}>
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      <Card className="rounded-2xl border-2 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>顧客一覧</CardTitle>
          <CardDescription>クリック操作は少なく、素早く検索できるようにしています。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>顧客名</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.tel ?? ""}</TableCell>
                      <TableCell>{r.email ?? ""}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => remove(r.id)} disabled={loading}>
                          削除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
