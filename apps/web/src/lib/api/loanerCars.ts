import { apiFetch } from "./core";

export type LoanerCar = {
  id: string;
  store_id: string;
  name: string;
  plate_no: string | null;
  color: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoanerReservation = {
  id: string;
  store_id: string;
  loaner_car_id: string;
  customer_name: string | null;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;   // "YYYY-MM-DD"
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type LoanerCarCreate = {
  name: string;
  plate_no?: string | null;
  color?: string | null;
  note?: string | null;
};

export type LoanerCarUpdate = Partial<LoanerCarCreate & { is_active: boolean }>;

export type LoanerReservationCreate = {
  loaner_car_id: string;
  customer_name?: string | null;
  start_date: string;
  end_date: string;
  note?: string | null;
};

export type LoanerReservationUpdate = {
  customer_name?: string | null;
  start_date?: string;
  end_date?: string;
  note?: string | null;
};

// ─── 代車マスタ ────────────────────────────────────────────────

export async function listLoanerCars(includeInactive = false): Promise<LoanerCar[]> {
  const q = includeInactive ? "?include_inactive=true" : "";
  return apiFetch<LoanerCar[]>(`/api/v1/loaner-cars${q}`);
}

export async function createLoanerCar(body: LoanerCarCreate): Promise<LoanerCar> {
  return apiFetch<LoanerCar>("/api/v1/loaner-cars", { method: "POST", body: JSON.stringify(body) });
}

export async function updateLoanerCar(id: string, body: LoanerCarUpdate): Promise<LoanerCar> {
  return apiFetch<LoanerCar>(`/api/v1/loaner-cars/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function deleteLoanerCar(id: string): Promise<void> {
  await apiFetch(`/api/v1/loaner-cars/${id}`, { method: "DELETE" });
}

// ─── 代車予約 ────────────────────────────────────────────────────

export async function listAllReservations(): Promise<LoanerReservation[]> {
  return apiFetch<LoanerReservation[]>("/api/v1/loaner-reservations");
}

export async function listReservationsByCar(carId: string): Promise<LoanerReservation[]> {
  return apiFetch<LoanerReservation[]>(`/api/v1/loaner-cars/${carId}/reservations`);
}

export async function createReservation(body: LoanerReservationCreate): Promise<LoanerReservation> {
  return apiFetch<LoanerReservation>("/api/v1/loaner-reservations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateReservation(
  id: string,
  body: LoanerReservationUpdate,
): Promise<LoanerReservation> {
  return apiFetch<LoanerReservation>(`/api/v1/loaner-reservations/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteReservation(id: string): Promise<void> {
  await apiFetch(`/api/v1/loaner-reservations/${id}`, { method: "DELETE" });
}

// ─── クライアント側重複チェック ────────────────────────────────────

/**
 * 既存の予約リストと照合して重複する予約を返す。
 * バックエンド送信前の事前警告に使用。
 */
export function findOverlappingReservations(
  reservations: LoanerReservation[],
  carId: string,
  startDate: string,
  endDate: string,
  excludeId?: string,
): LoanerReservation[] {
  return reservations.filter((r) => {
    if (r.loaner_car_id !== carId) return false;
    if (excludeId && r.id === excludeId) return false;
    // 重複判定: 既存.start <= 新.end && 既存.end >= 新.start
    return r.start_date <= endDate && r.end_date >= startDate;
  });
}
