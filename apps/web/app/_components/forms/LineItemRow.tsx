"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TaxType = "taxed10" | "taxed8" | "exempt" | "non_taxable";

export interface LineItem {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  tax_type: TaxType;
  note: string;
}

export const TAX_TYPE_OPTIONS: { value: TaxType; label: string }[] = [
  { value: "taxed10",     label: "課税10%" },
  { value: "taxed8",      label: "軽減8%" },
  { value: "exempt",      label: "非課税" },
  { value: "non_taxable", label: "不課税" },
];

export function calcLineAmount(item: LineItem): number {
  return Math.round(item.qty * item.unit_price);
}

interface Props {
  item: LineItem;
  index: number;
  total: number;
  onUpdate: (id: string, patch: Partial<LineItem>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  showTaxType?: boolean;
  nameOptions?: { value: string; label: string; unit_price?: number }[];
}

function fmtYen(n: number) {
  return `¥${Math.trunc(n).toLocaleString()}`;
}

export function LineItemRow({
  item,
  index,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  showTaxType = false,
  nameOptions = [],
}: Props) {
  const amount = calcLineAmount(item);

  function handleNameSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "__custom__") {
      onUpdate(item.id, { name: "" });
      return;
    }
    const opt = nameOptions.find((o) => o.value === v);
    if (opt) {
      onUpdate(item.id, {
        name: opt.label,
        ...(opt.unit_price != null ? { unit_price: opt.unit_price } : {}),
      });
    }
  }

  return (
    <div className="grid gap-2 rounded-md border bg-card p-3">
      {/* Row 1: 品目名 */}
      <div className="flex gap-2 items-center">
        {nameOptions.length > 0 && (
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-40 shrink-0"
            defaultValue=""
            onChange={handleNameSelect}
          >
            <option value="">マスタから選択</option>
            {nameOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        <Input
          className="h-9 text-sm flex-1"
          placeholder="品目名・作業名"
          value={item.name}
          onChange={(e) => onUpdate(item.id, { name: e.target.value })}
        />
        <div className="flex gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onMoveUp(item.id)}
            disabled={index === 0}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onMoveDown(item.id)}
            disabled={index === total - 1}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => onRemove(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Row 2: 数量・単価・金額・税区分 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">数量</div>
          <Input
            type="number"
            min={0}
            step="0.1"
            className="h-8 text-sm"
            value={item.qty}
            onChange={(e) => onUpdate(item.id, { qty: Number(e.target.value) })}
          />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">単価（税抜）</div>
          <Input
            type="number"
            min={0}
            step="1"
            className="h-8 text-sm"
            value={item.unit_price}
            onChange={(e) => onUpdate(item.id, { unit_price: Number(e.target.value) })}
          />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">金額</div>
          <div className="h-8 flex items-center text-sm font-medium text-right tabular-nums">
            {fmtYen(amount)}
          </div>
        </div>
        {showTaxType && (
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">税区分</div>
            <select
              className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={item.tax_type}
              onChange={(e) => onUpdate(item.id, { tax_type: e.target.value as TaxType })}
            >
              {TAX_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Row 3: 備考 */}
      <Input
        className="h-8 text-xs"
        placeholder="備考（任意）"
        value={item.note}
        onChange={(e) => onUpdate(item.id, { note: e.target.value })}
      />
    </div>
  );
}
