"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CustomerSelect } from "@/components/forms/CustomerSelect";
import { VehicleSelect } from "@/components/forms/VehicleSelect";
import { TaxCalculatorPanel } from "@/components/forms/TaxCalculatorPanel";
import { apiFetch, type Car } from "@/lib/api";

function fmtYen(n: number) {
  return `¥${Math.trunc(n).toLocaleString()}`;
}

interface OptionLine {
  id: string;
  name: string;
  price: number;
}

function newOption(): OptionLine {
  return { id: Math.random().toString(36).slice(2), name: "", price: 0 };
}

export default function CarSaleEstimatePage() {
  const router = useRouter();

  // 基本情報
  const [estDate, setEstDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // 顧客・車両
  const [customerId, setCustomerId] = React.useState("");
  const [vehicleId, setVehicleId] = React.useState("");
  const [selectedCar, setSelectedCar] = React.useState<Car | null>(null);

  // 価格
  const [carPrice, setCarPrice] = React.useState(0);
  const [options, setOptions] = React.useState<OptionLine[]>([]);
  const [jibaiseki, setJibaiseki] = React.useState(0);
  const [jyuryozei, setJyuryozei] = React.useState(0);
  const [registrationFee, setRegistrationFee] = React.useState(0);
  const [agencyFee, setAgencyFee] = React.useState(0);
  const [recyclingFee, setRecyclingFee] = React.useState(0);
  const [tradeInName, setTradeInName] = React.useState("");
  const [tradeInPrice, setTradeInPrice] = React.useState(0);

  // 合計計算
  const optionTotal = options.reduce((s, o) => s + o.price, 0);
  const taxSubject = carPrice + optionTotal;           // 課税対象（車両+付属品）
  const tax = Math.floor(taxSubject * 0.1);
  const legalFees = jibaiseki + jyuryozei + registrationFee + agencyFee + recyclingFee;
  const tradeIn = tradeInPrice > 0 ? -tradeInPrice : 0;
  const total = taxSubject + tax + legalFees + tradeIn;

  function handleAddTax(j: number, r: number) {
    setJibaiseki(j);
    setJyuryozei(r);
  }

  function updateOption(id: string, patch: Partial<OptionLine>) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  // 保存
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const lines = [
        { name: "車両本体価格", qty: 1, unit_price: carPrice },
        ...options.filter((o) => o.name).map((o) => ({ name: o.name, qty: 1, unit_price: o.price })),
        ...(jibaiseki > 0 ? [{ name: "自賠責保険料", qty: 1, unit_price: jibaiseki }] : []),
        ...(jyuryozei > 0 ? [{ name: "自動車重量税", qty: 1, unit_price: jyuryozei }] : []),
        ...(registrationFee > 0 ? [{ name: "登録費用", qty: 1, unit_price: registrationFee }] : []),
        ...(agencyFee > 0 ? [{ name: "代行費用", qty: 1, unit_price: agencyFee }] : []),
        ...(recyclingFee > 0 ? [{ name: "リサイクル預託金", qty: 1, unit_price: recyclingFee }] : []),
        ...(tradeInPrice > 0 && tradeInName ? [{ name: `下取り: ${tradeInName}`, qty: 1, unit_price: -tradeInPrice }] : []),
      ];

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
          <div className="text-xl font-semibold tracking-tight">車販見積書作成</div>
          <div className="text-sm text-muted-foreground">中古車販売の見積書を作成します</div>
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
            <div className="text-sm font-semibold">販売車両</div>
            <Separator />
            <VehicleSelect
              value={vehicleId}
              onChange={(id, car) => {
                setVehicleId(id);
                setSelectedCar(car);
                if (car?.salePrice) setCarPrice(car.salePrice);
              }}
            />
            {selectedCar && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {selectedCar.model && <div>型式: {selectedCar.model}</div>}
                {selectedCar.year && <div>年式: {selectedCar.year}年</div>}
                {selectedCar.mileage != null && <div>走行: {selectedCar.mileage.toLocaleString()} km</div>}
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

        {/* ── 右: 価格明細 ── */}
        <div className="space-y-4">
          {/* 車両本体価格 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">車両本体価格</div>
            <Separator />
            <div className="flex gap-2 items-center">
              <Input
                type="number" min={0} step={1000}
                className="text-sm"
                value={carPrice}
                onChange={(e) => setCarPrice(Number(e.target.value))}
              />
              <div className="text-sm text-muted-foreground whitespace-nowrap">
                税込 {fmtYen(carPrice + Math.floor(carPrice * 0.1))}
              </div>
            </div>
          </div>

          {/* 付属品・オプション */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">付属品・オプション</div>
              <Button type="button" size="sm" variant="outline" onClick={() => setOptions((p) => [...p, newOption()])}>
                <Plus className="h-3.5 w-3.5 mr-1" />追加
              </Button>
            </div>
            <Separator />
            {options.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-2">付属品・オプションがある場合は追加</div>
            )}
            {options.map((o) => (
              <div key={o.id} className="flex gap-2 items-center">
                <Input
                  className="flex-1 h-8 text-sm"
                  placeholder="品目名"
                  value={o.name}
                  onChange={(e) => updateOption(o.id, { name: e.target.value })}
                />
                <Input
                  type="number" min={0} step={1000}
                  className="w-32 h-8 text-sm"
                  value={o.price}
                  onChange={(e) => updateOption(o.id, { price: Number(e.target.value) })}
                />
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                  onClick={() => setOptions((p) => p.filter((x) => x.id !== o.id))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {options.length > 0 && (
              <div className="text-right text-sm text-muted-foreground">
                小計: {fmtYen(optionTotal)}
              </div>
            )}
          </div>

          {/* 法定費用 */}
          <TaxCalculatorPanel
            onAdd={handleAddTax}
            defaultFirstRegYear={selectedCar?.year ?? null}
          />
          {(jibaiseki > 0 || jyuryozei > 0) && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-sm">
              {jibaiseki > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自賠責保険料（非課税）</span>
                  <span className="tabular-nums">{fmtYen(jibaiseki)}</span>
                </div>
              )}
              {jyuryozei > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自動車重量税（非課税）</span>
                  <span className="tabular-nums">{fmtYen(jyuryozei)}</span>
                </div>
              )}
            </div>
          )}

          {/* 登録・代行費用 */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">登録費用・代行費用</div>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">登録費用（非課税）</Label>
                <Input type="number" min={0} step={1000} className="h-8 text-sm"
                  value={registrationFee} onChange={(e) => setRegistrationFee(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">代行費用</Label>
                <Input type="number" min={0} step={1000} className="h-8 text-sm"
                  value={agencyFee} onChange={(e) => setAgencyFee(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">リサイクル預託金（非課税）</Label>
                <Input type="number" min={0} step={100} className="h-8 text-sm"
                  value={recyclingFee} onChange={(e) => setRecyclingFee(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* 下取り */}
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">下取り車両</div>
            <Separator />
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">下取り車両名</Label>
                <Input className="h-8 text-sm" placeholder="例: トヨタ プリウス" value={tradeInName}
                  onChange={(e) => setTradeInName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">下取り額</Label>
                <Input type="number" min={0} step={1000} className="h-8 text-sm"
                  value={tradeInPrice} onChange={(e) => setTradeInPrice(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {/* 合計サマリー */}
          <div className="rounded-md border bg-card p-4 space-y-2">
            <div className="text-sm font-semibold">合計</div>
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">車両本体</span>
                <span className="tabular-nums">{fmtYen(carPrice)}</span>
              </div>
              {optionTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">付属品・オプション</span>
                  <span className="tabular-nums">{fmtYen(optionTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">消費税（10%）</span>
                <span className="tabular-nums">{fmtYen(tax)}</span>
              </div>
              {legalFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">法定費用・諸費用（非課税）</span>
                  <span className="tabular-nums">{fmtYen(legalFees)}</span>
                </div>
              )}
              {tradeInPrice > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>下取り</span>
                  <span className="tabular-nums">- {fmtYen(tradeInPrice)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>お支払合計</span>
                <span className="tabular-nums text-lg">{fmtYen(Math.max(0, total))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
