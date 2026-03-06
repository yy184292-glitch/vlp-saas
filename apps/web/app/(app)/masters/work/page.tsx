"use client";

import * as React from "react";
import Link from "next/link";

import { listWorkMasters, createWorkMaster, updateWorkMaster, deleteWorkMaster, WORK_CATEGORIES, VEHICLE_CATEGORIES } from "@/lib/api/workMasters";
import type { WorkMaster, WorkMasterCreate, WorkMasterUpdate } from "@/lib/api/workMasters";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight } from "lucide-react";

function yen(n: number | null): string {
  if (n === null || n === undefined) return "-";
  return "¥" + Math.round(n).toLocaleString();
}

function fmt(minutes: number): string {
  if (minutes < 60) return String(minutes) + "分";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? String(h) + "時間" + String(m) + "分" : String(h) + "時間";
}

type RateForm = { vehicle_category: string; duration_minutes: string; price: string };
type FormState = { work_name: string; work_category: string; sort_order: string; is_active: boolean; rates: RateForm[] };

function emptyRates(): RateForm[] {
  return VEHICLE_CATEGORIES.map(vc => ({ vehicle_category: vc, duration_minutes: "60", price: "" }));
}

function emptyForm(): FormState {
  return { work_name: "", work_category: "軽整備", sort_order: "0", is_active: true, rates: emptyRates() };
}

function validateForm(f: FormState): string | null {
  if (!f.work_name.trim()) return "作業名は必須です";
  for (const r of f.rates) {
    const d = Number(r.duration_minutes);
    if (!Number.isInteger(d) || d < 1) return r.vehicle_category + ": 作業時間は1分以上の整数";
    if (r.price !== "") { const pr = Number(r.price); if (!Number.isFinite(pr) || pr < 0) return r.vehicle_category + ": 工賃は0以上"; }
  }
  return null;
}

function formToPayload(f: FormState): WorkMasterCreate {
  return {
    work_name: f.work_name.trim(),
    work_category: f.work_category,
    sort_order: Number(f.sort_order) || 0,
    rates: f.rates.map(r => ({ vehicle_category: r.vehicle_category, duration_minutes: Number(r.duration_minutes), price: r.price === "" ? null : Number(r.price) })),
  };
}

export default function WorkMasterPage() {
  const [items, setItems] = React.useState<WorkMaster[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(() => emptyForm());
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listWorkMasters()); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "読み込み失敗"); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, WorkMaster[]>();
    for (const cat of WORK_CATEGORIES) map.set(cat, []);
    for (const item of items) {
      const arr = map.get(item.work_category);
      if (arr) arr.push(item); else map.set(item.work_category, [item]);
    }
    return map;
  }, [items]);

  const toggle = (id: string) => setExpanded(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setFormError(null); setDialogOpen(true); };

  const openEdit = (item: WorkMaster) => {
    setEditingId(item.id);
    const rateMap = new Map(item.rates.map(r => [r.vehicle_category, r]));
    setForm({
      work_name: item.work_name, work_category: item.work_category,
      sort_order: String(item.sort_order), is_active: item.is_active,
      rates: VEHICLE_CATEGORIES.map(vc => {
        const r = rateMap.get(vc);
        return { vehicle_category: vc, duration_minutes: r ? String(r.duration_minutes) : "60", price: r && r.price !== null ? String(r.price) : "" };
      }),
    });
    setFormError(null); setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setFormError(null); };

  const handleSave = async () => {
    const err = validateForm(form); if (err) { setFormError(err); return; }
    setSaving(true); setFormError(null);
    try {
      if (editingId) {
        const payload: WorkMasterUpdate = { ...formToPayload(form), is_active: form.is_active };
        await updateWorkMaster(editingId, payload);
      } else { await createWorkMaster(formToPayload(form)); }
      await load(); closeDialog();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "保存失敗"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: WorkMaster) => {
    if (!window.confirm("「" + item.work_name + "」を削除しますか？")) return;
    try { await deleteWorkMaster(item.id); await load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "削除失敗"); }
  };

  const isReadOnly = (item: WorkMaster) => item.store_id === null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">作業マスタ</div>
          <div className="text-sm text-muted-foreground">作業カテゴリ・車種別時間・工賃を管理します。</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline"><Link href="/masters">マスタトップへ</Link></Button>
          <Button onClick={openCreate}>+ 作業追加</Button>
        </div>
      </div>
      <Separator />
      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {!loading && Array.from(grouped.entries()).map(([cat, catItems]) => catItems.length === 0 ? null : (
        <Card key={cat} className="shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base">{cat} <span className="text-xs font-normal text-muted-foreground">({catItems.length}件)</span></CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {catItems.map(item => (
              <div key={item.id} className="border-t first:border-t-0">
                <div className="flex items-center justify-between gap-2 px-4 py-2">
                  <button className="flex items-center gap-1.5 text-left" onClick={() => toggle(item.id)}>
                    {expanded.has(item.id) ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="font-medium text-sm">{item.work_name}</span>
                    {isReadOnly(item) && <Badge variant="secondary" className="text-xs">システム</Badge>}
                    {!item.is_active && <Badge variant="outline" className="text-xs">無効</Badge>}
                  </button>
                  <div className="flex gap-2 shrink-0">
                    {isReadOnly(item) ? <span className="text-xs text-muted-foreground">変更不可</span> : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(item)}>編集</Button>
                        <Button size="sm" variant="destructive" onClick={() => void handleDelete(item)}>削除</Button>
                      </>
                    )}
                  </div>
                </div>
                {expanded.has(item.id) && (
                  <div className="mx-4 mb-3 rounded-md border bg-muted/30 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b">
                        <th className="px-3 py-1.5 text-left font-medium">車種</th>
                        <th className="px-3 py-1.5 text-right font-medium">作業時間</th>
                        <th className="px-3 py-1.5 text-right font-medium">工賃</th>
                      </tr></thead>
                      <tbody>
                        {item.rates.map(r => (
                          <tr key={r.id} className="border-b last:border-b-0">
                            <td className="px-3 py-1.5">{r.vehicle_category}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.duration_minutes)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{yen(r.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "作業編集" : "作業追加"}</DialogTitle></DialogHeader>
          {formError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{formError}</div>}
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="wm-name">作業名 *</Label>
                <Input id="wm-name" value={form.work_name} onChange={e => setForm(p => ({ ...p, work_name: e.target.value }))} placeholder="例: オイル交換" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wm-cat">作業カテゴリ *</Label>
                <select id="wm-cat" value={form.work_category} onChange={e => setForm(p => ({ ...p, work_category: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm">
                  {WORK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="wm-sort">表示順</Label>
                <Input id="wm-sort" inputMode="numeric" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} placeholder="0" />
              </div>
              {editingId && (
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="wm-active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  <Label htmlFor="wm-active">有効</Label>
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium mb-2">車種別時間・工賃</div>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left">車種</th>
                    <th className="px-3 py-2 text-left">作業時間（分）*</th>
                    <th className="px-3 py-2 text-left">工賃（円）</th>
                  </tr></thead>
                  <tbody>
                    {form.rates.map((r, i) => (
                      <tr key={r.vehicle_category} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 whitespace-nowrap">{r.vehicle_category}</td>
                        <td className="px-3 py-1.5">
                          <Input inputMode="numeric" value={r.duration_minutes} onChange={e => setForm(p => { const rates = [...p.rates]; rates[i] = { ...rates[i], duration_minutes: e.target.value }; return { ...p, rates }; })} className="h-8 w-20" />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input inputMode="numeric" value={r.price} onChange={e => setForm(p => { const rates = [...p.rates]; rates[i] = { ...rates[i], price: e.target.value }; return { ...p, rates }; })} className="h-8 w-24" placeholder="-" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
