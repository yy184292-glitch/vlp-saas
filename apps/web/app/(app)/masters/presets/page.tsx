"use client";

import * as React from "react";
import Link from "next/link";

import { listMaintenancePresets, listMaintenancePresetCategories, createMaintenancePreset, updateMaintenancePreset, deleteMaintenancePreset } from "@/lib/api/maintenancePresets";
import type { MaintenancePreset } from "@/lib/api/maintenancePresets";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDuration(minutes: number): string {
  if (minutes < 60) return String(minutes) + "分";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? String(h) + "時間" + String(m) + "分" : String(h) + "時間";
}

function yen(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return "¥" + Math.round(n).toLocaleString();
}

type FormState = { name: string; vehicle_category: string; duration_minutes: string; labor_price: string; sort_order: string; };

function emptyForm(defaultCategory: string): FormState {
  return { name: "", vehicle_category: defaultCategory, duration_minutes: "60", labor_price: "", sort_order: "0" };
}

function validateForm(f: FormState): string | null {
  if (!f.name.trim()) return "作業名は必須です";
  if (!f.vehicle_category) return "車両カテゴリを選択してください";
  const dur = Number(f.duration_minutes);
  if (!Number.isInteger(dur) || dur < 1) return "作業時間は1分以上の整数にしてください";
  if (f.labor_price !== "") { const lp = Number(f.labor_price); if (!Number.isFinite(lp) || lp < 0) return "工賞は0以上の数値にしてください"; }
  return null;
}

function formToPayload(f: FormState) {
  return { name: f.name.trim(), vehicle_category: f.vehicle_category, duration_minutes: Number(f.duration_minutes), labor_price: f.labor_price === "" ? null : Number(f.labor_price), sort_order: Number(f.sort_order) || 0 };
}

export default function PresetsPage() {
  const [presets, setPresets] = React.useState<MaintenancePreset[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterCategory, setFilterCategory] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(() => emptyForm(""));
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cats, rows] = await Promise.all([listMaintenancePresetCategories(), listMaintenancePresets()]);
      setCategories(cats); setPresets(rows);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "読み込みに失敗しました"); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const filtered = React.useMemo(() => {
    if (filterCategory === "all") return presets;
    return presets.filter((p) => p.vehicle_category === filterCategory);
  }, [presets, filterCategory]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm(categories[0] ?? "")); setFormError(null); setDialogOpen(true); };

  const openEdit = (preset: MaintenancePreset) => {
    setEditingId(preset.id);
    setForm({ name: preset.name, vehicle_category: preset.vehicle_category, duration_minutes: String(preset.duration_minutes), labor_price: preset.labor_price !== null ? String(preset.labor_price) : "", sort_order: String(preset.sort_order) });
    setFormError(null); setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormError(null); };

  const handleSave = async () => {
    const err = validateForm(form); if (err) { setFormError(err); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = formToPayload(form);
      if (editingId) { await updateMaintenancePreset(editingId, payload); } else { await createMaintenancePreset(payload); }
      await load(); closeDialog();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "保存に失敗しました"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (preset: MaintenancePreset) => {
    if (!window.confirm("「" + preset.name + "」を削除しますか？（元に戻せません）")) return;
    try { await deleteMaintenancePreset(preset.id); await load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "削除に失敗しました"); }
  };

  const isReadOnly = (preset: MaintenancePreset) => preset.is_default || preset.store_id === null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">整備プリセット</div>
          <div className="text-sm text-muted-foreground">車両カテゴリごとの整備メニューと工賞を管理します。</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline"><Link href="/masters">マスタトップへ</Link></Button>
          <Button onClick={openCreate}>+ プリセット追加</Button>
        </div>
      </div>
      <Separator />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">カテゴリ絞り込み：</span>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm">
          <option value="all">すべて</option>
          {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <span className="text-xs text-muted-foreground">（{filtered.length}件）</span>
      </div>
      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {!loading && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">プリセット一覧</CardTitle>
            <CardDescription><Badge variant="secondary" className="mr-1 text-xs">システム</Badge>はデフォルトプリセットです（変更不可）。</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-5 text-sm text-muted-foreground">プリセットがありません。右上から追加できます。</div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>作業名</TableHead><TableHead>車両カテゴリ</TableHead>
                    <TableHead className="text-right">作業時間</TableHead><TableHead className="text-right">工賞</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((preset) => (
                      <TableRow key={preset.id}>
                        <TableCell className="min-w-[200px]"><div className="flex items-center gap-2"><span className="font-medium">{preset.name}</span>{isReadOnly(preset) && <Badge variant="secondary" className="text-xs">システム</Badge>}</div></TableCell>
                        <TableCell className="min-w-[140px]">{preset.vehicle_category}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatDuration(preset.duration_minutes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{yen(preset.labor_price)}</TableCell>
                        <TableCell className="text-right">{isReadOnly(preset) ? <span className="text-xs text-muted-foreground">変更不可</span> : <div className="inline-flex gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(preset)}>編集</Button><Button size="sm" variant="destructive" onClick={() => void handleDelete(preset)}>削除</Button></div>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "プリセット編集" : "プリセット追加"}</DialogTitle></DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</div>}
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="preset-name">作業名 *</Label>
              <Input id="preset-name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="例: オイル交換" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-category">車両カテゴリ *</Label>
              <select id="preset-category" value={form.vehicle_category} onChange={(e) => setForm((prev) => ({ ...prev, vehicle_category: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm">
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="preset-duration">作業時間（分）*</Label>
                <Input id="preset-duration" inputMode="numeric" value={form.duration_minutes} onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))} placeholder="60" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="preset-labor">工賞（円）</Label>
                <Input id="preset-labor" inputMode="numeric" value={form.labor_price} onChange={(e) => setForm((prev) => ({ ...prev, labor_price: e.target.value }))} placeholder="空白=未設定" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="preset-sort">表示順</Label>
              <Input id="preset-sort" inputMode="numeric" value={form.sort_order} onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeDialog} disabled={saving}>キャンセル</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
