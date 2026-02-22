import { NextResponse } from "next/server";
import { CarUpsertSchema } from "../../../../../lib/schema/car";

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

const g = globalThis as unknown as { __cars?: CarRow[] };

function getCars() {
  g.__cars ??= [];
  return g.__cars;
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const parsed = CarUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation error", code: "VALIDATION", details: parsed.error.flatten() }, { status: 400 });
  }

  const cars = getCars();
  const i = cars.findIndex((x) => x.id === id);
  if (i < 0) return NextResponse.json({ message: "Not found", code: "NOT_FOUND" }, { status: 404 });

  cars[i] = { ...cars[i], ...parsed.data, updatedAt: new Date().toISOString() };
  return NextResponse.json(cars[i]);
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  const cars = getCars();
  const i = cars.findIndex((x) => x.id === id);
  if (i < 0) return NextResponse.json({ message: "Not found", code: "NOT_FOUND" }, { status: 404 });

  cars.splice(i, 1);
  return new NextResponse(null, { status: 204 });
}
