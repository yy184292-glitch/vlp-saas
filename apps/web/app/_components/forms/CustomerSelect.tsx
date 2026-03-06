"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";

export interface CustomerOption {
  id: string;
  name: string;
  name_kana: string | null;
  tel: string | null;
}

interface Props {
  value: string;
  onChange: (id: string, customer: CustomerOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomerSelect({ value, onChange, placeholder = "顧客を選択", disabled }: Props) {
  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch<CustomerOption[]>("/api/v1/customers")
      .then(setCustomers)
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const found = customers.find((c) => c.id === id) ?? null;
    onChange(id, found);
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || loading}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
    >
      <option value="">{loading ? "読み込み中..." : placeholder}</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}{c.name_kana ? `（${c.name_kana}）` : ""}{c.tel ? ` / ${c.tel}` : ""}
        </option>
      ))}
    </select>
  );
}
