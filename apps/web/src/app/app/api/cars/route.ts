import { NextResponse } from "next/server";
import { CarUpsertSchema } from "@/lib/schema/car";

type CarRow = {
  id: string;
  stockNo: string;
  maker: string;
  model: string;
  year: number;
  price: number;
  status: "available" | "reserved" | "sold";
  updatedAt: string;
};

// 超簡易インメモリ（検証用）: 本番ではDBへ
const g = globalThis as unknown as { __cars?: CarRow[] };
g.__cars ??= [
  {
    id: "1",
    stockNo: "A-0001",
    maker: "TOYOTA",
    model: "PRIUS",
    year: 2020,
    price: 1890000,
    status: "available",
    updatedAt: new Date().toISOString(),
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const status = url.searchParams.get("status");

  let items = g.__cars!;
  if (q) {
    items = items.filter((x) =>
      [x.stockNo, x.maker, x.model].some((v) => v.toLowerCase().includes(q))
    );
  }
  if (status && ["available", "reserved", "sold"].includes(status)) {
    items = items.filter((x) => x.status === status);
  }

  return NextResponse.json({ items, total: items.length, page: 1, pageSize: 50 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = CarUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation error", code: "VALIDATION", details: parsed.error.flatten() }, { status: 400 });
  }

  const row: CarRow = {
    id: crypto.randomUUID(),
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  g.__cars!.unshift(row);

  return NextResponse.json(row, { status: 201 });
}
