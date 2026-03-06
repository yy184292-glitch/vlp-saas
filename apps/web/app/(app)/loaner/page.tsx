"use client";

import * as React from "react";
import {
  listLoanerCars,
  listAllReservations,
  createLoanerCar,
  updateLoanerCar,
  deleteLoanerCar,
  createReservation,
  updateReservation,
  deleteReservation,
  findOverlappingReservations,
  type LoanerCar,
  type LoanerReservation,
} from "@/lib/api/loanerCars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Car, CalendarDays, Plus, Pencil, Trash2 } from "lucide-react";

// ─── 日付ユーティリティ ──────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${y}年${Number(m)}月${Number(day)}日`;
}

// ─── 代車登録フォーム ─────────────────────────────────────────────

type CarForm = { name: string; plate_no: string; color: string; note: string };

function emptyCarForm(): CarForm {
  return { name: "", plate_no: "", color: "", note: "" };
}

function carFormFromCar(c: LoanerCar): CarForm {
  return {
    name: c.name,
    plate_no: c.plate_no ?? "",
    color: c.color ?? "",
    note: c.note ?? "",
  };
}

// ─── 予約フォーム ────────────────────────────────────────────────

type ResForm = {
  loaner_car_id: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  note: string;
};

function emptyResForm(carId = ""): ResForm {
  const t = today();
  return { loaner_car_id: carId, customer_name: "", start_date: t, end_date: t, note: "" };
}

function resFormFromRes(r: LoanerReservation): ResForm {
  return {
    loaner_car_id: r.loaner_car_id,
    customer_name: r.customer_name ?? "",
    start_date: r.start_date,
    end_date: r.end_date,
    note: r.note ?? "",
  };
}

// ─── メインページ ────────────────────────────────────────────────

export default function LoanerPage() {
  const [cars, setCars] = React.useState<LoanerCar[]>([]);
  const [reservations, setReservations] = React.useState<LoanerReservation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // 代車ダイアログ
  const [carDialog, setCarDialog] = React.useState(false);
  const [editingCar, setEditingCar] = React.useState<LoanerCar | null>(null);
  const [carForm, setCarForm] = React.useState<CarForm>(emptyCarForm());
  const [carSaving, setCarSaving] = React.useState(false);
  const [carError, setCarError] = React.useState<string | null>(null);

  // 予約ダイアログ
  const [resDialog, setResDialog] = React.useState(false);
  const [editingRes, setEditingRes] = React.useState<LoanerReservation | null>(null);
  const [resForm, setResForm] = React.useState<ResForm>(emptyResForm());
  const [resSaving, setResSaving] = React.useState(false);
  const [resError, setResError] = React.useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = React.useState<LoanerReservation[]>([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        listLoanerCars(true),
        listAllReservations(),
      ]);
      setCars(c);
      setReservations(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  // ─── 代車フォーム ──────────────────────────────────────────────

  function openCreateCar() {
    setEditingCar(null);
    setCarForm(emptyCarForm());
    setCarError(null);
    setCarDialog(true);
  }

  function openEditCar(car: LoanerCar) {
    setEditingCar(car);
    setCarForm(carFormFromCar(car));
    setCarError(null);
    setCarDialog(true);
  }

  async function saveCar() {
    if (!carForm.name.trim()) { setCarError("代車名は必須です"); return; }
    setCarSaving(true);
    setCarError(null);
    try {
      const payload = {
        name: carForm.name.trim(),
        plate_no: carForm.plate_no.trim() || null,
        color: carForm.color.trim() || null,
        note: carForm.note.trim() || null,
      };
      if (editingCar) {
        await updateLoanerCar(editingCar.id, payload);
      } else {
        await createLoanerCar(payload);
      }
      await load();
      setCarDialog(false);
    } catch (e: unknown) {
      setCarError(e instanceof Error ? e.message : "保存失敗");
    } finally {
      setCarSaving(false);
    }
  }

  async function removeCar(car: LoanerCar) {
    if (!window.confirm(`「${car.name}」を削除しますか？\n関連する予約もすべて削除されます。`)) return;
    try {
      await deleteLoanerCar(car.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "削除失敗");
    }
  }

  // ─── 予約フォーム ──────────────────────────────────────────────

  function checkOverlap(form: ResForm, excludeId?: string) {
    if (!form.loaner_car_id || !form.start_date || !form.end_date) {
      setOverlapWarning([]);
      return;
    }
    const conflicts = findOverlappingReservations(
      reservations,
      form.loaner_car_id,
      form.start_date,
      form.end_date,
      excludeId,
    );
    setOverlapWarning(conflicts);
  }

  function openCreateRes(carId = "") {
    const f = emptyResForm(carId);
    setEditingRes(null);
    setResForm(f);
    setResError(null);
    setOverlapWarning([]);
    setResDialog(true);
  }

  function openEditRes(res: LoanerReservation) {
    const f = resFormFromRes(res);
    setEditingRes(res);
    setResForm(f);
    setResError(null);
    checkOverlap(f, res.id);
    setResDialog(true);
  }

  function updateResForm(patch: Partial<ResForm>) {
    const next = { ...resForm, ...patch };
    setResForm(next);
    checkOverlap(next, editingRes?.id);
  }

  async function saveRes() {
    if (!resForm.loaner_car_id) { setResError("代車を選択してください"); return; }
    if (!resForm.start_date || !resForm.end_date) { setResError("貸出期間を入力してください"); return; }
    if (resForm.end_date < resForm.start_date) { setResError("返却日は貸出開始日以降にしてください"); return; }
    setResSaving(true);
    setResError(null);
    try {
      const payload = {
        loaner_car_id: resForm.loaner_car_id,
        customer_name: resForm.customer_name.trim() || null,
        start_date: resForm.start_date,
        end_date: resForm.end_date,
        note: resForm.note.trim() || null,
      };
      if (editingRes) {
        await updateReservation(editingRes.id, payload);
      } else {
        await createReservation(payload);
      }
      await load();
      setResDialog(false);
    } catch (e: unknown) {
      setResError(e instanceof Error ? e.message : "保存失敗");
    } finally {
      setResSaving(false);
    }
  }

  async function removeRes(res: LoanerReservation) {
    const carName = cars.find((c) => c.id === res.loaner_car_id)?.name ?? "代車";
    if (!window.confirm(`${carName} の予約（${fmtDate(res.start_date)} 〜 ${fmtDate(res.end_date)}）を削除しますか？`)) return;
    try {
      await deleteReservation(res.id);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "削除失敗");
    }
  }

  // ─── 代車別予約リスト ─────────────────────────────────────────

  const resByCar = React.useMemo(() => {
    const map = new Map<string, LoanerReservation[]>();
    for (const r of reservations) {
      const arr = map.get(r.loaner_car_id) ?? [];
      arr.push(r);
      map.set(r.loaner_car_id, arr);
    }
    return map;
  }, [reservations]);

  // ─── レンダリング ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">代車管理</div>
          <div className="text-sm text-muted-foreground">代車の登録と予約スケジュールを管理します。</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openCreateRes}><CalendarDays className="h-4 w-4 mr-1" />予約を追加</Button>
          <Button onClick={openCreateCar}><Plus className="h-4 w-4 mr-1" />代車を登録</Button>
        </div>
      </div>

      <Separator />

      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 代車カード一覧 */}
      {!loading && cars.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          代車が登録されていません。「代車を登録」から追加してください。
        </div>
      )}

      <div className="grid gap-4">
        {cars.map((car) => {
          const carReservations = (resByCar.get(car.id) ?? []).sort(
            (a, b) => a.start_date.localeCompare(b.start_date),
          );
          return (
            <Card key={car.id} className="shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    {car.name}
                    {car.plate_no && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {car.plate_no}
                      </span>
                    )}
                    {!car.is_active && <Badge variant="outline" className="text-xs">無効</Badge>}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openCreateRes(car.id)}>
                      <CalendarDays className="h-3 w-3 mr-1" />予約追加
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditCar(car)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeCar(car)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 pb-3">
                {carReservations.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">予約なし</div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-3 py-1.5 text-left font-medium">貸出開始</th>
                          <th className="px-3 py-1.5 text-left font-medium">返却予定</th>
                          <th className="px-3 py-1.5 text-left font-medium">顧客名</th>
                          <th className="px-3 py-1.5 text-left font-medium">メモ</th>
                          <th className="px-3 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {carReservations.map((res) => {
                          const isActive = res.start_date <= today() && res.end_date >= today();
                          return (
                            <tr key={res.id} className="border-b last:border-b-0">
                              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                                {fmtDate(res.start_date)}
                                {isActive && (
                                  <span className="ml-2 text-[10px] font-bold text-amber-400">貸出中</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(res.end_date)}</td>
                              <td className="px-3 py-1.5">{res.customer_name ?? "-"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground max-w-[180px] truncate">
                                {res.note ?? "-"}
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => openEditRes(res)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => void removeRes(res)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── 代車登録ダイアログ ─────────────────────────────────── */}
      <Dialog open={carDialog} onOpenChange={(o) => { if (!o) setCarDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCar ? "代車を編集" : "代車を登録"}</DialogTitle>
          </DialogHeader>
          {carError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {carError}
            </div>
          )}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="car-name">代車名 *</Label>
              <Input
                id="car-name"
                value={carForm.name}
                onChange={(e) => setCarForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例: 代車1号、プリウス"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="car-plate">ナンバープレート</Label>
              <Input
                id="car-plate"
                value={carForm.plate_no}
                onChange={(e) => setCarForm((p) => ({ ...p, plate_no: e.target.value }))}
                placeholder="例: 品川 300 あ 1234"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="car-color">色</Label>
              <Input
                id="car-color"
                value={carForm.color}
                onChange={(e) => setCarForm((p) => ({ ...p, color: e.target.value }))}
                placeholder="例: ホワイト"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="car-note">メモ</Label>
              <Input
                id="car-note"
                value={carForm.note}
                onChange={(e) => setCarForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
            {editingCar && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="car-active"
                  checked={carForm.name !== "" && (editingCar.is_active)}
                  onChange={(e) => {
                    void updateLoanerCar(editingCar.id, { is_active: e.target.checked });
                  }}
                />
                <Label htmlFor="car-active">有効</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCarDialog(false)} disabled={carSaving}>キャンセル</Button>
            <Button onClick={() => void saveCar()} disabled={carSaving}>
              {carSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 予約ダイアログ ────────────────────────────────────── */}
      <Dialog open={resDialog} onOpenChange={(o) => { if (!o) setResDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRes ? "予約を編集" : "代車予約を追加"}</DialogTitle>
          </DialogHeader>

          {/* 重複警告バナー */}
          {overlapWarning.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">予約期間が重複しています</div>
                {overlapWarning.map((r) => (
                  <div key={r.id} className="text-xs">
                    {fmtDate(r.start_date)} 〜 {fmtDate(r.end_date)}
                    {r.customer_name ? `（${r.customer_name}）` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {resError}
            </div>
          )}

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="res-car">代車 *</Label>
              <select
                id="res-car"
                value={resForm.loaner_car_id}
                onChange={(e) => updateResForm({ loaner_car_id: e.target.value })}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              >
                <option value="">-- 代車を選択 --</option>
                {cars.filter((c) => c.is_active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.plate_no ? ` (${c.plate_no})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="res-start">貸出開始日 *</Label>
                <Input
                  id="res-start"
                  type="date"
                  value={resForm.start_date}
                  onChange={(e) => updateResForm({ start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="res-end">返却予定日 *</Label>
                <Input
                  id="res-end"
                  type="date"
                  value={resForm.end_date}
                  onChange={(e) => updateResForm({ end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="res-customer">顧客名</Label>
              <Input
                id="res-customer"
                value={resForm.customer_name}
                onChange={(e) => updateResForm({ customer_name: e.target.value })}
                placeholder="例: 山田 太郎"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="res-note">メモ</Label>
              <Input
                id="res-note"
                value={resForm.note}
                onChange={(e) => updateResForm({ note: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResDialog(false)} disabled={resSaving}>キャンセル</Button>
            <Button onClick={() => void saveRes()} disabled={resSaving}>
              {resSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
