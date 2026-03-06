"use client";

import * as React from "react";
import { type LineItem, calcLineAmount } from "./LineItemRow";

function fmtYen(n: number) {
  return `¥${Math.trunc(n).toLocaleString()}`;
}

export interface TaxSummary {
  subtotal: number;
  tax10: number;
  tax8: number;
  taxExempt: number;
  total: number;
}

export function calcTotals(items: LineItem[], extraExempt = 0): TaxSummary {
  let subtotal = 0;
  let base10 = 0;
  let base8 = 0;
  let exempt = 0;

  for (const item of items) {
    const amount = calcLineAmount(item);
    subtotal += amount;
    if (item.tax_type === "taxed10") base10 += amount;
    else if (item.tax_type === "taxed8") base8 += amount;
    else exempt += amount;
  }

  // 法定費用など追加の非課税
  exempt += extraExempt;
  subtotal += extraExempt;

  const tax10 = Math.floor(base10 * 0.1);
  const tax8 = Math.floor(base8 * 0.08);
  const total = subtotal + tax10 + tax8;

  return { subtotal, tax10, tax8, taxExempt: exempt, total };
}

interface Props {
  items: LineItem[];
  extraExempt?: number;
  extraExemptLabel?: string;
  showTaxBreakdown?: boolean;
}

export function TotalSummary({
  items,
  extraExempt = 0,
  extraExemptLabel,
  showTaxBreakdown = false,
}: Props) {
  const totals = calcTotals(items, extraExempt);

  return (
    <div className="rounded-md border bg-card p-4 space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">小計（税抜）</span>
        <span className="tabular-nums font-medium">{fmtYen(totals.subtotal)}</span>
      </div>

      {extraExempt > 0 && extraExemptLabel && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="pl-3">うち {extraExemptLabel}</span>
          <span className="tabular-nums">{fmtYen(extraExempt)}</span>
        </div>
      )}

      {showTaxBreakdown ? (
        <>
          {totals.tax10 > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">消費税（10%）</span>
              <span className="tabular-nums">{fmtYen(totals.tax10)}</span>
            </div>
          )}
          {totals.tax8 > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">消費税（8%軽減）</span>
              <span className="tabular-nums">{fmtYen(totals.tax8)}</span>
            </div>
          )}
          {totals.taxExempt > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>非課税・不課税</span>
              <span className="tabular-nums">{fmtYen(totals.taxExempt)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">消費税（10%）</span>
          <span className="tabular-nums">{fmtYen(totals.tax10)}</span>
        </div>
      )}

      <div className="border-t pt-2 flex justify-between text-base font-bold">
        <span>合計（税込）</span>
        <span className="tabular-nums text-lg">{fmtYen(totals.total)}</span>
      </div>
    </div>
  );
}
