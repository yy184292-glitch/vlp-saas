// Inventory domain
import { apiFetch } from "./core";

export type InventoryItem = {
  id: string;
  store_id: string | null;
  sku: string | null;
  name: string | null;
  unit: string | null;
  cost_price: string | null;
  sale_price: string | null;
  qty_on_hand: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InventoryItemInput = {
  store_id: string;
  sku?: string | null;
  name: string;
  unit?: string | null;
  cost_price?: number | null;
  sale_price?: number | null;
  qty_on_hand?: number | null;
  note?: string | null;
};

export type StockMove = {
  id: string;
  store_id: string | null;
  item_id: string | null;
  qty_delta: string | null;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateStockMoveInput = {
  store_id: string;
  item_id: string;
  qty_delta: number;
  reason?: string | null;
  ref_type?: string | null;
  ref_id?: string | null;
  note?: string | null;
};

type ListWithMeta<T> = {
  items: T[];
  meta?: { limit?: number; offset?: number; total?: number };
};

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function normalizeInventoryItem(raw: unknown): InventoryItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNullableString(r.id) ?? "",
    store_id: toNullableString(r.store_id),
    sku: toNullableString(r.sku),
    name: toNullableString(r.name),
    unit: toNullableString(r.unit),
    cost_price: toNullableString(r.cost_price),
    sale_price: toNullableString(r.sale_price),
    qty_on_hand: toNullableString(r.qty_on_hand),
    note: toNullableString(r.note),
    created_at: toNullableString(r.created_at),
    updated_at: toNullableString(r.updated_at),
  };
}

function normalizeStockMove(raw: unknown): StockMove {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNullableString(r.id) ?? "",
    store_id: toNullableString(r.store_id),
    item_id: toNullableString(r.item_id),
    qty_delta: toNullableString(r.qty_delta),
    reason: toNullableString(r.reason),
    ref_type: toNullableString(r.ref_type),
    ref_id: toNullableString(r.ref_id),
    note: toNullableString(r.note),
    created_at: toNullableString(r.created_at),
    updated_at: toNullableString(r.updated_at),
  };
}

function coerceItemsArray<T>(data: unknown, normalize: (x: unknown) => T): T[] {
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    return (data as any).items.map(normalize);
  }
  if (Array.isArray(data)) return data.map(normalize);
  return [];
}

export function getCurrentStoreId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem("store_id");
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export async function listInventoryItems(args?: {
  limit?: number;
  offset?: number;
  store_id?: string;
}): Promise<{ items: InventoryItem[]; meta?: ListWithMeta<unknown>["meta"] }> {
  const p = new URLSearchParams();
  if (args?.limit != null) p.set("limit", String(args.limit));
  if (args?.offset != null) p.set("offset", String(args.offset));
  if (args?.store_id) p.set("store_id", args.store_id);
  const qs = p.toString();
  const data = await apiFetch<unknown>(`/api/v1/inventory/items${qs ? `?${qs}` : ""}`, {
    method: "GET",
    auth: true,
  });
  const items = coerceItemsArray(data, normalizeInventoryItem).filter((x) => x.id);
  const meta =
    data && typeof data === "object" && (data as any).meta
      ? ((data as any).meta as any)
      : undefined;
  return { items, meta };
}

export async function getInventoryItem(itemId: string): Promise<InventoryItem> {
  const data = await apiFetch<unknown>(`/api/v1/inventory/items/${encodeURIComponent(itemId)}`, {
    method: "GET",
    auth: true,
  });
  return normalizeInventoryItem(data);
}

export async function createInventoryItem(input: InventoryItemInput): Promise<InventoryItem> {
  const data = await apiFetch<unknown>("/api/v1/inventory/items", {
    method: "POST",
    auth: true,
    body: input,
  });
  return normalizeInventoryItem(data);
}

export async function updateInventoryItem(
  itemId: string,
  input: Partial<InventoryItemInput>
): Promise<InventoryItem> {
  const data = await apiFetch<unknown>(`/api/v1/inventory/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    auth: true,
    body: input,
  });
  return normalizeInventoryItem(data);
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  await apiFetch<void>(`/api/v1/inventory/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    auth: true,
  });
}

export async function listStockMoves(args?: {
  limit?: number;
  offset?: number;
  store_id?: string;
  item_id?: string;
  ref_id?: string;
}): Promise<{ items: StockMove[]; meta?: ListWithMeta<unknown>["meta"] }> {
  const p = new URLSearchParams();
  if (args?.limit != null) p.set("limit", String(args.limit));
  if (args?.offset != null) p.set("offset", String(args.offset));
  if (args?.store_id) p.set("store_id", args.store_id);
  if (args?.item_id) p.set("item_id", args.item_id);
  if (args?.ref_id) p.set("ref_id", args.ref_id);
  const qs = p.toString();
  const data = await apiFetch<unknown>(`/api/v1/inventory/moves${qs ? `?${qs}` : ""}`, {
    method: "GET",
    auth: true,
  });
  const items = coerceItemsArray(data, normalizeStockMove).filter((x) => x.id);
  const meta =
    data && typeof data === "object" && (data as any).meta
      ? ((data as any).meta as any)
      : undefined;
  return { items, meta };
}

export async function createStockMove(input: CreateStockMoveInput): Promise<StockMove> {
  const data = await apiFetch<unknown>("/api/v1/inventory/moves", {
    method: "POST",
    auth: true,
    body: input,
  });
  return normalizeStockMove(data);
}
