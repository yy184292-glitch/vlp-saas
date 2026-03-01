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

export default function InventoryMasterPage() {
  const [rows, setRows] = React.useState<InventoryItem[]>([]);
  const [me, setMe] = React.useState<Me | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Omit<InventoryItemCreateIn, "store_id">>({
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

  const create = React.useCallback(async () => {
    if (!me?.store_id) return;
    if (!form.name.trim()) {
      setError("部材名を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: InventoryItemCreateIn = {
        store_id: me.store_id,
        sku: form.sku || null,
        name: form.name,
        unit: form.unit || null,
        cost_price: form.cost_price || "0",
        sale_price: form.sale_price || "0",
        qty_on_hand: form.qty_on_hand || "0",
        note: form.note || null,
      };
      await apiFetch<InventoryItem>("/api/v1/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setOpen(false);
      setForm({ sku: "", name: "", unit: "個", cost_price: "0", sale_price: "0", qty_on_hand: "0", note: "" });
      await load();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [form, me, load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">在庫管理</div>
          <div className="text-sm text-muted-foreground">部材の一覧・追加。入庫は経費（部材）自動計上と連動できます。</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
            <Link href="/masters">各種マスタへ戻る</Link>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
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
                  <Label>部材名</Label>
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
                <Button variant="outline" className="bg-white/70 hover:bg-white" onClick={() => setOpen(false)}>
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
          <CardDescription>素早く一覧確認し、追加できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="rounded-xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>部材名</TableHead>
                  <TableHead>在庫</TableHead>
                  <TableHead>仕入</TableHead>
                  <TableHead>売価</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.sku ?? ""}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.qty_on_hand}</TableCell>
                      <TableCell>{r.cost_price}</TableCell>
                      <TableCell>{r.sale_price}</TableCell>
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
