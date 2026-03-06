"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CustomerSelect, type CustomerOption } from "@/app/_components/forms/CustomerSelect";
import { VehicleSelect } from "@/app/_components/forms/VehicleSelect";
import { LineItemRow, type LineItem } from "@/app/_components/forms/LineItemRow";
import { TotalSummary } from "@/app/_components/forms/TotalSummary";
import { createWorkReport, listWorkMasters, type Car, type WorkMaster } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "pending" | "in_progress" | "completed" | "cancelled";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "pending",    label: "受付中" },
  { value: "in_progress", label: "作業中" },
  { value: "completed",  label: "完了" },
  { value: "cancelled",  label: "キャンセル" },
];

function newItem(overrides?: Partial<LineItem>): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: "",
    qty: 1,
    unit_price: 0,
    tax_type: "taxed10",
    note: "",
    ...overrides,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WorkOrderNewPage() {
  const router = useRouter();

  // 基本情報
  const [receiptDate, setReceiptDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [status, setStatus] = React.useState<Status>("pending");
  const [mileage, setMileage] = React.useState("");
  const [shakenExpiry, setShakenExpiry] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // 車両・顧客
  const [vehicleId, setVehicleId] = React.useState("");
  const [selectedCar, setSelectedCar] = React.useState<Car | null>(null);
  const [customerId, setCustomerId] = React.useState("");

  // 作業マスタ
  const [workMasters, setWorkMasters] = React.useState<WorkMaster[]>([]);
  React.useEffect(() => {
    listWorkMasters().then(setWorkMasters).catch(() => {});
  }, []);

  const workOptions = React.useMemo(
    () => workMasters.map((m) => ({
      value: m.id,
      label: m.work_name,
      unit_price: m.rates[0]?.price ?? 0,
    })),
    [workMasters]
  );

  // 明細行
  const [workItems, setWorkItems] = React.useState<LineItem[]>([newItem()]);
  const [materialItems, setMaterialItems] = React.useState<LineItem[]>([]);

  const allItems = [...workItems, ...materialItems];

  function updateItem(
    list: LineItem[],
    setList: React.Dispatch<React.SetStateAction<LineItem[]>>,
    id: string,
    patch: Partial<LineItem>
  ) {
    setList((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(
    list: LineItem[],
    setList: React.Dispatch<React.SetStateAction<LineItem[]>>,
    id: string
  ) {
    setList((prev) => prev.filter((it) => it.id !== id));
  }

  function moveItem(
    list: LineItem[],
    setList: React.Dispatch<React.SetStateAction<LineItem[]>>,
    id: string,
    dir: "up" | "down"
  ) {
    setList((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  // 保存
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const items = allItems
        .filter((it) => it.name.trim())
        .map((it, i) => ({
          item_name: it.name,
          item_type: workItems.includes(it) ? ("work" as const) : ("material" as const),
          quantity: it.qty,
          unit_price: it.unit_price,
          memo: it.note || null,
          sort_order: i,
        }));

      const report = await createWorkReport({
        car_id: vehicleId || null,
        notes: notes || null,
        items,
      });
      router.push(`/work-orders/${report.id}/report`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">指示書作成</div>
          <div className="text-sm text-muted-foreground">作業指示書を新規作成します</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />印刷
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />{saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
        {/* ── 左カラム: 基本情報 ── */}
        <div className="space-y-4">
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">基本情報</div>
            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs">受付日</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">納期</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">担当者</Label>
              <Input placeholder="担当者名" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ステータス</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 車両 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">車両</div>
            <Separator />
            <VehicleSelect
              value={vehicleId}
              onChange={(id, car) => {
                setVehicleId(id);
                setSelectedCar(car);
                if (car?.mileage) setMileage(String(car.mileage));
              }}
            />
            {selectedCar && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {selectedCar.model && <div>型式: {selectedCar.model}</div>}
                {selectedCar.year && <div>年式: {selectedCar.year}年</div>}
                {selectedCar.carNumber && <div>ナンバー: {selectedCar.carNumber}</div>}
              </div>
            )}
            <a
              href="/cars/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              ＋ 新規車両登録
            </a>
            <div className="space-y-1.5">
              <Label className="text-xs">走行距離（km）</Label>
              <Input type="number" placeholder="例: 50000" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">車検期限</Label>
              <Input type="date" value={shakenExpiry} onChange={(e) => setShakenExpiry(e.target.value)} />
            </div>
          </div>

          {/* 顧客 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">顧客</div>
            <Separator />
            <CustomerSelect
              value={customerId}
              onChange={(id) => setCustomerId(id)}
            />
            <a
              href="/customers/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              ＋ 新規顧客登録
            </a>
          </div>

          {/* 備考 */}
          <div className="rounded-md border bg-card p-4 space-y-2">
            <div className="text-sm font-semibold">備考</div>
            <Separator />
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="特記事項・連絡事項など"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── 右カラム: 作業内容 ── */}
        <div className="space-y-4">
          {/* 作業 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">作業内容</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setWorkItems((p) => [...p, newItem({ tax_type: "taxed10" })])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />作業を追加
              </Button>
            </div>
            <Separator />
            {workItems.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                「作業を追加」から追加してください
              </div>
            )}
            <div className="space-y-2">
              {workItems.map((item, i) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  total={workItems.length}
                  nameOptions={workOptions}
                  onUpdate={(id, patch) => updateItem(workItems, setWorkItems, id, patch)}
                  onRemove={(id) => removeItem(workItems, setWorkItems, id)}
                  onMoveUp={(id) => moveItem(workItems, setWorkItems, id, "up")}
                  onMoveDown={(id) => moveItem(workItems, setWorkItems, id, "down")}
                />
              ))}
            </div>
          </div>

          {/* 部品・材料 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">部品・材料</div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setMaterialItems((p) => [...p, newItem({ tax_type: "taxed10" })])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />部品を追加
              </Button>
            </div>
            <Separator />
            {materialItems.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                部品・材料がある場合は追加してください
              </div>
            )}
            <div className="space-y-2">
              {materialItems.map((item, i) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  total={materialItems.length}
                  onUpdate={(id, patch) => updateItem(materialItems, setMaterialItems, id, patch)}
                  onRemove={(id) => removeItem(materialItems, setMaterialItems, id)}
                  onMoveUp={(id) => moveItem(materialItems, setMaterialItems, id, "up")}
                  onMoveDown={(id) => moveItem(materialItems, setMaterialItems, id, "down")}
                />
              ))}
            </div>
          </div>

          {/* 合計 */}
          <TotalSummary items={allItems} />
        </div>
      </div>
    </div>
  );
}
