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

type InventoryItem = {
  id: string;
  store_id: string;
  sku?: string | null;
  name: string;
  unit?: string | null;
  cost_price: string;
  sale_price: string;
  qty_on_hand: string;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

type Me = {
  id: string;
  store_id: string;
};

type InventoryItemCreateIn = {
  store_id: string;
  sku?: string | null;
  name: string;
  unit?: string | null;
  cost_price: string;
  sale_price: string;
  qty_on_hand: string;
  note?: string | null;
};

type InventoryItemUpdateIn = Omit<InventoryItemCreateIn, "store_id">;

function normalize(s: string) {
  return (s ?? "").toLowerCase().trim();
}

function toNumText(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString();
}

export default function InventoryMasterPage() {
  const [rows, setRows] = React.useState<InventoryItem[]>([]);
  const [me, setMe] = React.useState<Me | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InventoryItem | null>(null);

  const [form, setForm] = React.useState<Omit<InventoryItemCreateIn, "store_id">>({
    sku: "",
    name: "",
    unit: "個",
    cost_price: "0",
    sale_price: "0",
    qty_on_hand: "0",
    note: "",
  });

  const [editForm, setEditForm] = React.useState<InventoryItemUpdateIn>({
    sku: "",
    name: "",
    unit: "個",
    cost_price: "0",
    sale_price: "0",
    qty_on_hand: "0",
    note: "",
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await apiFetch<Me>("/api/v1/users/me");
      setMe(meRes);

      const list = await apiFetch<InventoryItem[]>("/api/v1/inventory/items");
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
      const hay = [r.sku ?? "", r.name, r.unit ?? "", r.note ?? ""].map(normalize).join(" ");
      return hay.includes(nq);
    });
  }, [rows, q]);

  const validate = (f: InventoryItemUpdateIn) => {
    if (!f.name.trim()) return "部材名を入力してください";
    if (Number.isNaN(Number(f.cost_price))) return "仕入単価が不正です";
    if (Number.isNaN(Number(f.sale_price))) return "売価が不正です";
    if (Number.isNaN(Number(f.qty_on_hand))) return "在庫数が不正です";
    return null;
  };

  const create = React.useCallback(async () => {
    if (!me?.store_id) return;

    const v = validate(form);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: InventoryItemCreateIn = {
        store_id: me.store_id,
        sku: form.sku?.trim() || null,
        name: form.name.trim(),
        unit: form.unit?.trim() || null,
        cost_price: form.cost_price || "0",
        sale_price: form.sale_price || "0",
        qty_on_hand: form.qty_on_hand || "0",
        note: form.note?.trim() || null,
      };
      await apiFetch<InventoryItem>("/api/v1/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setCreateOpen(false);
      setForm({ sku: "", name: "", unit: "個", cost_price: "0", sale_price: "0", qty_on_hand: "0", note: "" });
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form, me, load]);

  const openEdit = React.useCallback((r: InventoryItem) => {
    setEditing(r);
    setEditForm({
      sku: r.sku ?? "",
      name: r.name,
      unit: r.unit ?? "個",
      cost_price: r.cost_price ?? "0",
      sale_price: r.sale_price ?? "0",
      qty_on_hand: r.qty_on_hand ?? "0",
      note: r.note ?? "",
    });
    setEditOpen(true);
  }, []);

  const saveEdit = React.useCallback(async () => {
    if (!editing) return;
    const v = validate(editForm);
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: InventoryItemUpdateIn = {
        sku: editForm.sku?.trim() || null,
        name: editForm.name.trim(),
        unit: editForm.unit?.trim() || null,
        cost_price: editForm.cost_price || "0",
        sale_price: editForm.sale_price || "0",
        qty_on_hand: editForm.qty_on_hand || "0",
        note: editForm.note?.trim() || null,
      };

      await apiFetch<InventoryItem>(`/api/v1/inventory/items/${editing.id}`, {
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
    async (r: InventoryItem) => {
      const ok = window.confirm(`「${r.name}」を削除します。よろしいですか？`);
      if (!ok) return;

      setLoading(true);
      setError(null);
      try {
        await apiFetch(`/api/v1/inventory/items/${r.id}`, { method: "DELETE" });
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
          <div className="text-2xl font-semibold tracking-tight">在庫管理</div>
          <div className="text-sm text-muted-foreground">部材の一覧・追加・編集・削除。</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
            <Link href="/masters">各種マスタへ戻る</Link>
          </Button>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">部材追加</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>部材追加</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>SKU</Label>
                  <Input value={form.sku ?? ""} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>単位</Label>
                  <Input value={form.unit ?? ""} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>部材名（必須）</Label>
                  <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>仕入単価</Label>
                  <Input value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2">
                  <Label>売価</Label>
                  <Input value={form.sale_price} onChange={(e) => setForm((p) => ({ ...p, sale_price: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2">
                  <Label>在庫数（初期）</Label>
                  <Input value={form.qty_on_hand} onChange={(e) => setForm((p) => ({ ...p, qty_on_hand: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>メモ</Label>
                  <Input value={form.note ?? ""} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} className="bg-white" />
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
          <CardTitle>部材一覧</CardTitle>
          <CardDescription>検索してすぐ編集できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="grid gap-1">
              <Label>検索</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="w-[320px] max-w-full bg-white" placeholder="SKU/部材名/メモ..." />
            </div>
            <div className="text-sm text-muted-foreground">{filtered.length} 件</div>
          </div>

          <div className="rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>部材名</TableHead>
                  <TableHead>在庫</TableHead>
                  <TableHead>仕入</TableHead>
                  <TableHead>売価</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.sku ?? ""}</TableCell>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.note ? <div className="text-xs text-muted-foreground">{r.note}</div> : null}
                      </TableCell>
                      <TableCell>{toNumText(r.qty_on_hand)}</TableCell>
                      <TableCell>{toNumText(r.cost_price)}</TableCell>
                      <TableCell>{toNumText(r.sale_price)}</TableCell>
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
                <DialogTitle>部材編集</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>SKU</Label>
                  <Input value={editForm.sku ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>単位</Label>
                  <Input value={editForm.unit ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, unit: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>部材名（必須）</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="bg-white" />
                </div>

                <div className="grid gap-2">
                  <Label>仕入単価</Label>
                  <Input value={editForm.cost_price} onChange={(e) => setEditForm((p) => ({ ...p, cost_price: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2">
                  <Label>売価</Label>
                  <Input value={editForm.sale_price} onChange={(e) => setEditForm((p) => ({ ...p, sale_price: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2">
                  <Label>在庫数</Label>
                  <Input value={editForm.qty_on_hand} onChange={(e) => setEditForm((p) => ({ ...p, qty_on_hand: e.target.value }))} className="bg-white" inputMode="decimal" />
                </div>

                <div className="grid gap-2 sm:col-span-2">
                  <Label>メモ</Label>
                  <Input value={editForm.note ?? ""} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} className="bg-white" />
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
