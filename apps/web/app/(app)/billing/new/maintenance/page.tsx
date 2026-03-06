"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CustomerSelect, type CustomerOption } from "@/components/forms/CustomerSelect";
import { VehicleSelect } from "@/components/forms/VehicleSelect";
import { LineItemRow, type LineItem } from "@/components/forms/LineItemRow";
import { TotalSummary, calcTotals } from "@/components/forms/TotalSummary";
import { TaxCalculatorPanel } from "@/components/forms/TaxCalculatorPanel";
import { apiFetch, listWorkMasters, type Car, type WorkMaster } from "@/lib/api";

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

export default function MaintenanceEstimatePage() {
  const router = useRouter();

  // 基本情報
  const [estDate, setEstDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // 車両・顧客
  const [vehicleId, setVehicleId] = React.useState("");
  const [selectedCar, setSelectedCar] = React.useState<Car | null>(null);
  const [customerId, setCustomerId] = React.useState("");

  // 作業マスタ
  const [workMasters, setWorkMasters] = React.useState<WorkMaster[]>([]);
  React.useEffect(() => { listWorkMasters().then(setWorkMasters).catch(() => {}); }, []);

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

  // 法定費用（自賠責・重量税）
  function handleAddTax(jibaiseki: number, jyuryozei: number) {
    if (jibaiseki > 0) {
      setWorkItems((prev) => [
        ...prev,
        newItem({ name: "自賠責保険料", unit_price: jibaiseki, qty: 1, tax_type: "exempt" }),
      ]);
    }
    if (jyuryozei > 0) {
      setWorkItems((prev) => [
        ...prev,
        newItem({ name: "自動車重量税", unit_price: jyuryozei, qty: 1, tax_type: "exempt" }),
      ]);
    }
  }

  // 保存
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totals = calcTotals(allItems);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const lines = allItems
        .filter((it) => it.name.trim())
        .map((it) => ({ name: it.name, qty: it.qty, unit_price: it.unit_price }));

      await apiFetch("/api/v1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "estimate",
          status: "draft",
          customer_name: customerId || null,
          lines,
        }),
      });
      router.push("/billing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">整備見積書作成</div>
          <div className="text-sm text-muted-foreground">整備・修理の見積書を作成します</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
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
        {/* ── 左: 基本情報 ── */}
        <div className="space-y-4">
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">基本情報</div>
            <Separator />
            <div className="space-y-1.5">
              <Label className="text-xs">見積日</Label>
              <Input type="date" value={estDate} onChange={(e) => setEstDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">有効期限</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">担当者</Label>
              <Input placeholder="担当者名" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">件名</Label>
              <Input placeholder="例: 定期点検整備一式" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">顧客</div>
            <Separator />
            <CustomerSelect value={customerId} onChange={(id) => setCustomerId(id)} />
            <a href="/customers/new" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              ＋ 新規顧客登録
            </a>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">車両</div>
            <Separator />
            <VehicleSelect
              value={vehicleId}
              onChange={(id, car) => { setVehicleId(id); setSelectedCar(car); }}
            />
            {selectedCar && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {selectedCar.model && <div>型式: {selectedCar.model}</div>}
                {selectedCar.year && <div>年式: {selectedCar.year}年</div>}
              </div>
            )}
            <a href="/cars/new" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              ＋ 新規車両登録
            </a>
          </div>

          <div className="rounded-md border bg-card p-4 space-y-2">
            <div className="text-sm font-semibold">備考</div>
            <Separator />
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="特記事項など"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* ── 右: 明細 ── */}
        <div className="space-y-4">
          {/* 作業 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">作業内容</div>
              <Button type="button" size="sm" variant="outline"
                onClick={() => setWorkItems((p) => [...p, newItem()])}>
                <Plus className="h-3.5 w-3.5 mr-1" />作業を追加
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              {workItems.map((item, i) => (
                <LineItemRow
                  key={item.id} item={item} index={i} total={workItems.length}
                  showTaxType nameOptions={workOptions}
                  onUpdate={(id, p) => updateItem(workItems, setWorkItems, id, p)}
                  onRemove={(id) => removeItem(workItems, setWorkItems, id)}
                  onMoveUp={(id) => moveItem(workItems, setWorkItems, id, "up")}
                  onMoveDown={(id) => moveItem(workItems, setWorkItems, id, "down")}
                />
              ))}
            </div>
          </div>

          {/* 部品 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">部品・材料</div>
              <Button type="button" size="sm" variant="outline"
                onClick={() => setMaterialItems((p) => [...p, newItem()])}>
                <Plus className="h-3.5 w-3.5 mr-1" />部品を追加
              </Button>
            </div>
            <Separator />
            {materialItems.length === 0 && (
              <div className="text-sm text-muted-foreground py-2 text-center">部品・材料がある場合は追加</div>
            )}
            <div className="space-y-2">
              {materialItems.map((item, i) => (
                <LineItemRow
                  key={item.id} item={item} index={i} total={materialItems.length}
                  showTaxType
                  onUpdate={(id, p) => updateItem(materialItems, setMaterialItems, id, p)}
                  onRemove={(id) => removeItem(materialItems, setMaterialItems, id)}
                  onMoveUp={(id) => moveItem(materialItems, setMaterialItems, id, "up")}
                  onMoveDown={(id) => moveItem(materialItems, setMaterialItems, id, "down")}
                />
              ))}
            </div>
          </div>

          {/* 法定費用 */}
          <TaxCalculatorPanel
            onAdd={handleAddTax}
            defaultFirstRegYear={selectedCar?.year ?? null}
          />

          {/* 合計 */}
          <TotalSummary items={allItems} showTaxBreakdown />
        </div>
      </div>
    </div>
  );
}
