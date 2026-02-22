// lib/api.ts
import { apiRequest, jsonBody } from "./http";

/** FastAPI: app/schemas/car.py に合わせた最低限の型（必要に応じて増やせる） */
export type Car = {
  id: string;

  stock_no: string;
  car_number?: string | null;
  status?: string;

  maker?: string | null;
  model?: string | null;
  model_code?: string | null;
  grade?: string | null;

  year?: number | null;
  year_month?: string | null;

  mileage?: number | null;
  color?: string | null;

  vin?: string | null;

  purchase_price?: number | null;
  expected_sell_price?: number | null;
  actual_sell_price?: number | null;

  purchase_date?: string | null; // date(ISO)
  sell_date?: string | null;     // date(ISO)

  location?: string | null;
  memo?: string | null;

  inspection_expiry?: string | null; // date(ISO)
  insurance_expiry?: string | null;  // date(ISO)

  created_at: string; // datetime(ISO)
  updated_at: string; // datetime(ISO)
};

export type CreateCarInput = {
  stock_no: string;
  car_number?: string | null;
  status?: string;

  maker?: string | null;
  model?: string | null;
  model_code?: string | null;
  grade?: string | null;

  year?: number | null;
  year_month?: string | null;

  mileage?: number | null;
  color?: string | null;

  vin?: string | null;

  purchase_price?: number | null;
  expected_sell_price?: number | null;
  actual_sell_price?: number | null;

  purchase_date?: string | null;
  sell_date?: string | null;

  location?: string | null;
  memo?: string | null;

  inspection_expiry?: string | null;
  insurance_expiry?: string | null;
};

export type UpdateCarInput = Partial<CreateCarInput>;

/** OCR: POST /ocr/shaken (multipart) */
export type OcrShakenResult = {
  success: boolean;
  text: string;
  fields: {
    maker?: string | null;
    model?: string | null;
    year?: string | number | null;
    vin?: string | null;
    model_code?: string | null;
    [k: string]: unknown;
  };
};

export async function listCars(): Promise<Car[]> {
  return apiRequest<Car[]>("/cars", { method: "GET" });
}

export async function createCar(input: CreateCarInput): Promise<Car> {
  // stock_no は必須：UIで必ず入れる
  return apiRequest<Car>("/cars", {
    method: "POST",
    body: jsonBody(input),
  });
}

export async function updateCar(carId: string, input: UpdateCarInput): Promise<Car> {
  return apiRequest<Car>(`/cars/${carId}`, {
    method: "PATCH",
    body: jsonBody(input),
  });
}

export async function deleteCar(carId: string): Promise<void> {
  await apiRequest<void>(`/cars/${carId}`, { method: "DELETE" });
}

export async function ocrShaken(file: File): Promise<OcrShakenResult> {
  const fd = new FormData();
  fd.append("file", file);

  // http.ts 側で FormData のとき Content-Type を勝手に付けない実装ならこれでOK
  return apiRequest<OcrShakenResult>("/ocr/shaken", {
    method: "POST",
    body: fd,
  });
}
