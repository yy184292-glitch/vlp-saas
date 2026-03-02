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
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Customer = {
  id: string;
  store_id: string;
  name: string;
  name_kana?: string | null;
  honorific: string;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
  email?: string | null;
  contact_person?: string | null;
  invoice_number?: string | null;
  payment_terms?: string | null;
  created_at: string;
  updated_at: string;
};

type Me = {
  id: string;
  store_id: string;
};

type CustomerCreateIn = {
  store_id: string;
  name: string;
  name_kana?: string | null;
  honorific?: string | null;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
  email?: string | null;
  contact_person?: string | null;
  invoice_number?: string | null;
  payment_terms?: string | null;
};

type CustomerUpdateIn = Omit<CustomerCreateIn, "store_id">;

function normalize(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export default function CustomersMasterPage() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [rows, setRows] = React.useState<Customer[]>([]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);

  const [form, setForm] = React.useState<Omit<CustomerCreateIn, "store_id">>({
    name: "",
    name_kana: "",
    honorific: "御中",
    postal_code: "",
    address1: "",
    address2: "",
    tel: "",
    email: "",
    contact_person: "",
    invoice_number: "",
    payment_terms: "",
  });

  const [editForm, setEditForm] = React.useState<CustomerUpdateIn>({
    name: "",
    name_kana: "",
    honorific: "御中",
    postal_code: "",
    address1: "",
    address2: "",
    tel: "",
    email: "",
    contact_person: "",
    invoice_number: "",
    payment_terms: "",
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await apiFetch<Me>("/api/v1/users/me");
      setMe(meRes);

      const list = await apiFetch<Customer[]>("/api/v1/customers");
      setRows(list || []);
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

  const filtered = React.useMemo(() => {
    const nq = normalize(q);
    if (!nq) return rows;
    return rows.filter((r) => {
      const hay = [
        r.name,
        r.name_kana ?? "",
        r.tel ?? "",
        r.email ?? "",
        r.contact_person ?? "",
        r.invoice_number ?? "",
        r.address1 ?? "",
        r.address2 ?? "",
      ]
        .map(normalize)
        .join(" ");
      return hay.includes(nq);
    });
  }, [rows, q]);

  const resetCreateForm = React.useCallback(() => {
    setForm({
      name: "",
      name_kana: "",
      honorific: "御中",
      postal_code: "",
      address1: "",
      address2: "",
      tel: "",
      email: "",
      contact_person: "",
      invoice_number: "",
      payment_terms: "",
    });
  }, []);

  const openEdit = React.useCallback((c: Customer) => {
    setEditing(c);
    setEditForm({
      name: c.name,
      name_kana: c.name_kana ?? "",
      honorific: c.honorific ?? "御中",
      postal_code: c.postal_code ?? "",
      address1: c.address1 ?? "",
      address2: c.address2 ?? "",
      tel: c.tel ?? "",
      email: c.email ?? "",
      contact_person: c.contact_person ?? "",
      invoice_number: c.invoice_number ?? "",
      payment_terms: c.payment_terms ?? "",
    });
    setEditOpen(true);
  }, []);

  const validate = (name: string) => {
    if (!name.trim()) return "顧客名を入力してください";
    if (name.trim().length > 255) return "顧客名が長すぎます";
    return null;
  };

  const create = React.useCallback(async () => {
    if (!me?.store_id) return;
    const v = validate(form.name);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CustomerCreateIn = {
        store_id: me.store_id,
        name: form.name.trim(),
        name_kana: form.name_kana?.trim() || null,
        honorific: form.honorific?.trim() || null,
        postal_code: form.postal_code?.trim() || null,
        address1: form.address1?.trim() || null,
        address2: form.address2?.trim() || null,
        tel: form.tel?.trim() || null,
        email: form.email?.trim() || null,
        contact_person: form.contact_person?.trim() || null,
        invoice_number: form.invoice_number?.trim() || null,
        payment_terms: form.payment_terms?.trim() || null,
      };

      await apiFetch<Customer>("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setCreateOpen(false);
      resetCreateForm();
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form, me, load, resetCreateForm]);

  const saveEdit = React.useCallback(async () => {
    if (!editing) return;
    const v = validate(editForm.name);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: CustomerUpdateIn = {
        name: editForm.name.trim(),
        name_kana: editForm.name_kana?.trim() || null,
        honorific: editForm.honorific?.trim() || null,
        postal_code: editForm.postal_code?.trim() || null,
        address1: editForm.address1?.trim() || null,
        address2: editForm.address2?.trim() || null,
        tel: editForm.tel?.trim() || null,
        email: editForm.email?.trim() || null,
        contact_person: editForm.contact_person?.trim() || null,
        invoice_number: editForm.invoice_number?.trim() || null,
        payment_terms: editForm.payment_terms?.trim() || null,
      };

      await apiFetch<Customer>(`/api/v1/customers/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [editing, editForm, load]);

  const remove = React.useCallback(
    async (c: Customer) => {
      const ok = window.confirm(`「${c.name}」を削除します。よろしいですか？`);
      if (!ok) return;

      setLoading(true);
      setError(null);
      try {
        await apiFetch(`/api/v1/customers/${c.id}`, { method: "DELETE" });
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
          <div className="text-sm text-muted-foreground">顧客の登録・検索・編集・削除。</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
            <Link href="/masters">各種マスタへ戻る</Link>
          </Button>

          <Dialog open={createOpen} onOpenChange={(v) => (setCreateOpen(v), v ? null : resetCreateForm())}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">顧客追加</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>顧客追加</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>顧客名（必須）</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>顧客名カナ</Label>
                  <Input value={form.name_kana ?? ""} onChange={(e) => setForm((p) => ({ ...p, name_kana: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>敬称</Label>
                  <Input value={form.honorific ?? ""} onChange={(e) => setForm((p) => ({ ...p, honorific: e.target.value }))} className="bg-white" placeholder="御中 / 様" />
                </div>

                <div className="grid gap-2">
                  <Label>電話</Label>
                  <Input value={form.tel ?? ""} onChange={(e) => setForm((p) => ({ ...p, tel: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>メール</Label>
                  <Input value={form.email ?? ""} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="bg-white" inputMode="email" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>住所</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input value={form.postal_code ?? ""} onChange={(e) => setForm((p) => ({ ...p, postal_code: e.target.value }))} className="bg-white" placeholder="郵便番号" />
                    <Input value={form.address1 ?? ""} onChange={(e) => setForm((p) => ({ ...p, address1: e.target.value }))} className="bg-white sm:col-span-2" placeholder="住所1" />
                  </div>
                  <Input value={form.address2 ?? ""} onChange={(e) => setForm((p) => ({ ...p, address2: e.target.value }))} className="bg-white" placeholder="住所2" />
                </div>

                <div className="grid gap-2">
                  <Label>担当者</Label>
                  <Input value={form.contact_person ?? ""} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>請求書番号</Label>
                  <Input value={form.invoice_number ?? ""} onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>支払条件</Label>
                  <Input value={form.payment_terms ?? ""} onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))} className="bg-white" placeholder="例: 月末締め翌月末" />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => setCreateOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={create} disabled={loading || !me?.store_id}>
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
          <CardDescription>検索してすぐ編集できます。</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="grid gap-1">
              <Label>検索</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="w-[320px] max-w-full bg-white" placeholder="顧客名/電話/メール/住所..." />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} 件</div>
          </div>

          <div className="rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>顧客名</TableHead>
                  <TableHead>電話</TableHead>
                  <TableHead>メール</TableHead>
                  <TableHead>担当</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.name}
                        <div className="text-xs text-muted-foreground">
                          {r.postal_code ? `〒${r.postal_code} ` : ""}
                          {(r.address1 ?? "") + (r.address2 ? ` ${r.address2}` : "")}
                        </div>
                      </TableCell>
                      <TableCell>{r.tel ?? ""}</TableCell>
                      <TableCell>{r.email ?? ""}</TableCell>
                      <TableCell>{r.contact_person ?? ""}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => openEdit(r)}>
                            編集
                          </Button>
                          <Button variant="outline" className="bg-white/70 hover:bg-white text-destructive" onClick={() => remove(r)}>
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

          <Dialog open={editOpen} onOpenChange={(v) => (setEditOpen(v), v ? null : setEditing(null))}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>顧客編集</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label>顧客名（必須）</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>顧客名カナ</Label>
                  <Input value={editForm.name_kana ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, name_kana: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>敬称</Label>
                  <Input value={editForm.honorific ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, honorific: e.target.value }))} className="bg-white" placeholder="御中 / 様" />
                </div>

                <div className="grid gap-2">
                  <Label>電話</Label>
                  <Input value={editForm.tel ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, tel: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>メール</Label>
                  <Input value={editForm.email ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} className="bg-white" inputMode="email" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>住所</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input value={editForm.postal_code ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, postal_code: e.target.value }))} className="bg-white" placeholder="郵便番号" />
                    <Input value={editForm.address1 ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, address1: e.target.value }))} className="bg-white sm:col-span-2" placeholder="住所1" />
                  </div>
                  <Input value={editForm.address2 ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, address2: e.target.value }))} className="bg-white" placeholder="住所2" />
                </div>

                <div className="grid gap-2">
                  <Label>担当者</Label>
                  <Input value={editForm.contact_person ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, contact_person: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>請求書番号</Label>
                  <Input value={editForm.invoice_number ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, invoice_number: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>支払条件</Label>
                  <Input value={editForm.payment_terms ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, payment_terms: e.target.value }))} className="bg-white" placeholder="例: 月末締め翌月末" />
                </div>
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => setEditOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={saveEdit} disabled={loading || !editing}>
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
