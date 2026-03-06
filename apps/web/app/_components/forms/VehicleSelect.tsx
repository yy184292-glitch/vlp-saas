"use client";

import * as React from "react";
import { listCars, type Car } from "@/lib/api";

interface Props {
  value: string;
  onChange: (id: string, car: Car | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function VehicleSelect({ value, onChange, placeholder = "車両を選択", disabled }: Props) {
  const [cars, setCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    listCars()
      .then(setCars)
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const found = cars.find((c) => c.id === id) ?? null;
    onChange(id, found);
  }

  function carLabel(car: Car): string {
    const parts: string[] = [];
    if (car.make || car.maker) parts.push(car.make ?? car.maker ?? "");
    if (car.model) parts.push(car.model);
    if (car.year) parts.push(`${car.year}年`);
    if (car.carNumber) parts.push(car.carNumber);
    return parts.join(" ") || car.id.slice(0, 8);
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || loading}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
    >
      <option value="">{loading ? "読み込み中..." : placeholder}</option>
      {cars.map((c) => (
        <option key={c.id} value={c.id}>
          {carLabel(c)}
        </option>
      ))}
    </select>
  );
}
