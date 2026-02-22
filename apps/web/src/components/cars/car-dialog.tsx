"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, CarUpsertInput } from "@/lib/schema/car";
import { CarForm } from "./car-form";

export function CarDialog({
  open,
  onOpenChange,
  car,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  car: Car | null; // null なら新規
  onSave: (input: CarUpsertInput, id?: string) => Promise<void>;
  saving?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{car ? "車両編集" : "車両追加"}</DialogTitle>
        </DialogHeader>
        <CarForm
          defaultValues={car ?? {}}
          submitting={saving}
          onSubmit={async (v) => {
            await onSave(v, car?.id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
