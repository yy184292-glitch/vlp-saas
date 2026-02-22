"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, CarUpsertInput } from "@/lib/schema/car";
import { createCar, deleteCar, listCars, updateCar } from "@/lib/api/cars";
import { isApiError } from "@/lib/api/errors";
import { CarDialog } from "./car-dialog";
import { CarFilters, type CarFilterState } from "./car-filters";
import { toast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Trash2 } from "lucide-react";

export function CarsTable() {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Car[]>([]);
  const [total, setTotal] = React.useState(0);

  const [filters, setFilters] = React.useState<CarFilterState>({ q: "", status: "all" });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Car | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCars({
        q: filters.q || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        page: 1,
        pageSize: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = isApiError(e) ? e.message : "読み込みに失敗しました";
      toast({ title: "エラー", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters.q, filters.status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onSave(input: CarUpsertInput, id?: string) {
    setSaving(true);
    try {
      if (id) {
        await updateCar(id, input);
        toast({ title: "更新しました" });
      } else {
        await createCar(input);
        toast({ title: "追加しました" });
      }
      await load();
    } catch (e) {
      const msg = isApiError(e) ? e.message : "保存に失敗しました";
      toast({ title: "エラー", description: msg, variant: "destructive" });
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    try {
      await deleteCar(id);
      toast({ title: "削除しました" });
      await load();
    } catch (e) {
      const msg = isApiError(e) ? e.message : "削除に失敗しました";
      toast({ title: "エラー", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
        <CarFilters value={filters} onChange={setFilters} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            更新
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            追加
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm text-muted-foreground">
            {loading ? "読み込み中..." : `${total} 件`}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">在庫番号</TableHead>
              <TableHead>メーカー</TableHead>
              <TableHead>車種</TableHead>
              <TableHead className="w-[100px]">年式</TableHead>
              <TableHead className="w-[140px] text-right">価格</TableHead>
              <TableHead className="w-[120px]">状態</TableHead>
              <TableHead className="w-[120px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => {
                  setEditing(c);
                  setDialogOpen(true);
                }}
              >
                <TableCell className="font-medium">{c.stockNo}</TableCell>
                <TableCell>{c.maker}</TableCell>
                <TableCell>{c.model}</TableCell>
                <TableCell>{c.year}</TableCell>
                <TableCell className="text-right">{c.price.toLocaleString()}</TableCell>
                <TableCell>{renderStatus(c.status)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDelete(c.id);
                    }}
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  データがありません
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <CarDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        car={editing}
        onSave={onSave}
        saving={saving}
      />
    </div>
  );
}

function renderStatus(status: Car["status"]) {
  switch (status) {
    case "available":
      return <Badge variant="secondary">在庫</Badge>;
    case "reserved":
      return <Badge>商談中</Badge>;
    case "sold":
      return <Badge variant="destructive">売約</Badge>;
  }
}
