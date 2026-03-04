// Cars domain: cars, valuations, OCR, statuses
import { apiFetch, ApiError } from "./core";

export type Car = {
  id: string;
  stockNo: string | null;
  status: string | null;
  make: string | null;
  maker: string | null;
  model: string | null;
  grade: string | null;
  year: number | null;
  mileage: number | null;
  carNumber: string | null;
  vin: string | null;
  modelCode: string | null;
  color: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  expectedBuyPrice: number | null;
  expectedSellPrice: number | null;
  expectedProfit: number | null;
  expectedProfitRate: number | null;
  valuationAt: string | null;
  ownerName: string | null;
  ownerNameKana: string | null;
  ownerPostalCode: string | null;
  ownerAddress1: string | null;
  ownerAddress2: string | null;
  ownerTel: string | null;
  newOwnerName: string | null;
  newOwnerNameKana: string | null;
  newOwnerPostalCode: string | null;
  newOwnerAddress1: string | null;
  newOwnerAddress2: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CarInput = {
  stock_no?: string | null;
  status?: string | null;
  make?: string | null;
  maker?: string | null;
  model?: string | null;
  grade?: string | null;
  year?: number | null;
  mileage?: number | null;
  car_number?: string | null;
  vin?: string | null;
  model_code?: string | null;
  color?: string | null;
  purchase_price?: number | null;
  sale_price?: number | null;
};

export type ShakenOcrFields = {
  maker?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
  model_code?: string | null;
  car_number?: string | null;
};

export type ShakenOcrResult = {
  text: string;
  fields: ShakenOcrFields;
};

export type CarStatus = {
  id: string;
  name: string;
  tone?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type CarValuation = {
  id: string;
  carId: string;
  storeId: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitRate: number;
  valuationAt: string;
  createdAt: string;
};

export type ValuationCalculateRequest = {
  make: string;
  model: string;
  grade: string;
  year: number;
  mileage: number;
};

export type ValuationCalculateResult = {
  marketLow: number;
  marketMedian: number;
  marketHigh: number;
  buyCapPrice: number;
  recommendedPrice: number;
  expectedProfit: number;
  expectedProfitRate: number;
};

type CarsListResponse = {
  items: unknown[];
  meta: { limit: number; offset: number; total: number };
};

type CarValuationsListResponse = {
  items: unknown[];
  meta: { limit: number; offset: number; total: number };
};

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

function toNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeCar(raw: unknown): Car {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNullableString(r.id) ?? "",
    stockNo: toNullableString(r.stock_no ?? r.stockNo),
    status: toNullableString(r.status),
    make: toNullableString(r.make),
    maker: toNullableString(r.maker),
    model: toNullableString(r.model),
    grade: toNullableString(r.grade),
    year: toNullableNumber(r.year),
    mileage: toNullableNumber(r.mileage),
    carNumber: toNullableString(r.car_number ?? r.carNumber),
    vin: toNullableString(r.vin),
    modelCode: toNullableString(r.model_code ?? r.modelCode),
    color: toNullableString(r.color),
    purchasePrice: toNullableNumber(r.purchase_price ?? r.purchasePrice),
    salePrice: toNullableNumber(r.sale_price ?? r.salePrice),
    expectedBuyPrice: toNullableNumber(r.expected_buy_price ?? r.expectedBuyPrice),
    expectedSellPrice: toNullableNumber(r.expected_sell_price ?? r.expectedSellPrice),
    expectedProfit: toNullableNumber(r.expected_profit ?? r.expectedProfit),
    expectedProfitRate: toNullableNumber(r.expected_profit_rate ?? r.expectedProfitRate),
    valuationAt: toNullableString(r.valuation_at ?? r.valuationAt),
    ownerName: toNullableString(r.owner_name ?? r.ownerName),
    ownerNameKana: toNullableString(r.owner_name_kana ?? r.ownerNameKana),
    ownerPostalCode: toNullableString(r.owner_postal_code ?? r.ownerPostalCode),
    ownerAddress1: toNullableString(r.owner_address1 ?? r.ownerAddress1),
    ownerAddress2: toNullableString(r.owner_address2 ?? r.ownerAddress2),
    ownerTel: toNullableString(r.owner_tel ?? r.ownerTel),
    newOwnerName: toNullableString(r.new_owner_name ?? r.newOwnerName),
    newOwnerNameKana: toNullableString(r.new_owner_name_kana ?? r.newOwnerNameKana),
    newOwnerPostalCode: toNullableString(r.new_owner_postal_code ?? r.newOwnerPostalCode),
    newOwnerAddress1: toNullableString(r.new_owner_address1 ?? r.newOwnerAddress1),
    newOwnerAddress2: toNullableString(r.new_owner_address2 ?? r.newOwnerAddress2),
    createdAt: toNullableString(r.created_at ?? r.createdAt),
    updatedAt: toNullableString(r.updated_at ?? r.updatedAt),
  };
}

function normalizeValuation(raw: unknown): CarValuation {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id),
    carId: String(r.car_id),
    storeId: String(r.store_id),
    buyPrice: Number(r.buy_price),
    sellPrice: Number(r.sell_price),
    profit: Number(r.profit),
    profitRate: Number(r.profit_rate),
    valuationAt: String(r.valuation_at),
    createdAt: String(r.created_at),
  };
}

function normalizeCalculateResult(raw: any): ValuationCalculateResult {
  return {
    marketLow: Number(raw?.market_low ?? 0),
    marketMedian: Number(raw?.market_median ?? 0),
    marketHigh: Number(raw?.market_high ?? 0),
    buyCapPrice: Number(raw?.buy_cap_price ?? 0),
    recommendedPrice: Number(raw?.recommended_price ?? 0),
    expectedProfit: Number(raw?.expected_profit ?? 0),
    expectedProfitRate: Number(raw?.expected_profit_rate ?? 0),
  };
}

export async function listCars(args?: { limit?: number; offset?: number }): Promise<{
  items: Car[];
  meta: { limit: number; offset: number; total: number };
}> {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;
  const data = await apiFetch<CarsListResponse>(`/api/v1/cars?limit=${limit}&offset=${offset}`, {
    method: "GET",
    auth: true,
  });
  const items = Array.isArray(data?.items) ? data.items.map(normalizeCar).filter((c) => c.id) : [];
  return { items, meta: data.meta };
}

export async function createCar(input: CarInput): Promise<Car> {
  const data = await apiFetch<unknown>("/api/v1/cars", { method: "POST", body: input, auth: true });
  return normalizeCar(data);
}

export async function getCar(carId: string): Promise<Car> {
  const data = await apiFetch<unknown>(`/api/v1/cars/${encodeURIComponent(carId)}`, {
    method: "GET",
    auth: true,
  });
  return normalizeCar(data);
}

export async function updateCar(carId: string, input: Partial<CarInput>): Promise<Car> {
  if (!carId) {
    throw new ApiError({ status: 400, url: "/api/v1/cars/:id", message: "carId is required" });
  }
  const data = await apiFetch<unknown>(`/api/v1/cars/${encodeURIComponent(carId)}`, {
    method: "PATCH",
    auth: true,
    body: input,
  });
  return normalizeCar(data);
}

export async function deleteCar(id: string): Promise<void> {
  if (!id) return;
  await apiFetch<void>(`/api/v1/cars/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

export async function ocrShaken(file: File): Promise<ShakenOcrResult> {
  const form = new FormData();
  form.append("file", file);
  const data = await apiFetch<unknown>("/api/v1/ocr/shaken", {
    method: "POST",
    body: form,
    auth: true,
    headers: {},
  });
  const anyData = data as any;
  return {
    text: String(anyData?.text ?? ""),
    fields: (anyData?.fields ?? {}) as ShakenOcrFields,
  };
}

export async function listCarStatuses(): Promise<CarStatus[]> {
  const data = await apiFetch<unknown>("/api/v1/masters/car-statuses", { method: "GET", auth: true });
  const arr = Array.isArray(data) ? data : [];
  return arr.map((x: any) => ({
    id: String(x?.id ?? ""),
    name: String(x?.name ?? ""),
    tone: (x?.tone ?? null) as string | null,
    sort_order: (typeof x?.sort_order === "number" ? x.sort_order : null) as number | null,
    is_active: (typeof x?.is_active === "boolean" ? x.is_active : null) as boolean | null,
  }));
}

export async function listCarValuations(
  carId: string,
  args?: { limit?: number; offset?: number }
): Promise<CarValuation[]> {
  const limit = args?.limit ?? 50;
  const offset = args?.offset ?? 0;
  const data = await apiFetch<CarValuationsListResponse>(
    `/api/v1/cars/${encodeURIComponent(carId)}/valuations?limit=${limit}&offset=${offset}`,
    { method: "GET", auth: true }
  );
  return Array.isArray(data.items) ? data.items.map(normalizeValuation) : [];
}

export async function calculateValuation(payload: ValuationCalculateRequest): Promise<ValuationCalculateResult> {
  const res = await apiFetch<any>("/api/v1/valuation/calculate", {
    method: "POST",
    auth: true,
    body: payload,
  });
  return normalizeCalculateResult(res);
}
