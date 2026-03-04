"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Car, CarInput } from "@/lib/api";
import { CarForm } from "./car-form";
import type { CarUpsertInput } from "@/lib/schema/car";

export function CarDialog({
  open,
  onOpenChange,
  car,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  car: Car | null;
  onSave: (input: CarInput, id?: string) => Promise<void>;
  saving?: boolean;
}) {
  // 新 Car 型 → CarForm が期待する CarUpsertInput へのマッピング
  const defaultValues: Partial<CarUpsertInput> = car
    ? {
        stockNo: car.stockNo ?? "",
        maker: car.maker ?? "",
        model: car.model ?? "",
        year: car.year ?? new Date().getFullYear(),
        price: car.salePrice ?? 0,
        status: (car.status as CarUpsertInput["status"]) ?? "available",
      }
    : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{car ? "車両編集" : "車両追加"}</DialogTitle>
        </DialogHeader>
        <CarForm
          defaultValues={defaultValues}
          submitting={saving}
          onSubmit={async (v) => {
            // CarUpsertInput → CarInput へ変換
            const input: CarInput = {
              stock_no: v.stockNo,
              maker: v.maker,
              model: v.model,
              year: v.year,
              sale_price: v.price,
              status: v.status,
            };
            await onSave(input, car?.id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
