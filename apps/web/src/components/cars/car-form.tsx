"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CarUpsertInput, CarUpsertSchema } from "@/lib/schema/car";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CarForm({
  defaultValues,
  onSubmit,
  submitting,
}: {
  defaultValues: Partial<CarUpsertInput>;
  onSubmit: (v: CarUpsertInput) => Promise<void> | void;
  submitting?: boolean;
}) {
  const form = useForm<CarUpsertInput>({
    resolver: zodResolver(CarUpsertSchema),
    defaultValues: {
      stockNo: defaultValues.stockNo ?? "",
      maker: defaultValues.maker ?? "",
      model: defaultValues.model ?? "",
      year: (defaultValues.year as any) ?? new Date().getFullYear(),
      price: (defaultValues.price as any) ?? 0,
      status: defaultValues.status ?? "available",
    },
    mode: "onChange",
  });

  const { register, handleSubmit, formState, setValue, watch } = form;
  const status = watch("status");

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="在庫番号" error={formState.errors.stockNo?.message}>
          <Input {...register("stockNo")} autoComplete="off" />
        </Field>
        <Field label="メーカー" error={formState.errors.maker?.message}>
          <Input {...register("maker")} autoComplete="off" />
        </Field>
        <Field label="車種" error={formState.errors.model?.message}>
          <Input {...register("model")} autoComplete="off" />
        </Field>
        <Field label="年式" error={formState.errors.year?.message}>
          <Input type="number" {...register("year", { valueAsNumber: true })} />
        </Field>
        <Field label="価格" error={formState.errors.price?.message}>
          <Input type="number" {...register("price", { valueAsNumber: true })} />
        </Field>
        <Field label="ステータス" error={formState.errors.status?.message}>
          <Select value={status} onValueChange={(v) => setValue("status", v as any, { shouldValidate: true })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">在庫</SelectItem>
              <SelectItem value="reserved">商談中</SelectItem>
              <SelectItem value="sold">売約</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={!formState.isValid || !!submitting}>
          保存
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
