"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CarFilterState = {
  q: string;
  status: "all" | "available" | "reserved" | "sold";
};

export function CarFilters({
  value,
  onChange,
}: {
  value: CarFilterState;
  onChange: (next: CarFilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <Input
        placeholder="検索（在庫番号 / メーカー / 車種）"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        className="md:w-96"
      />
      <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v as any })}>
        <SelectTrigger className="md:w-56">
          <SelectValue placeholder="ステータス" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">すべて</SelectItem>
          <SelectItem value="available">在庫</SelectItem>
          <SelectItem value="reserved">商談中</SelectItem>
          <SelectItem value="sold">売約</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
