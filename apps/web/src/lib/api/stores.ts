import { apiFetch } from "./core";

export interface Store {
  id: string;
  name: string;
  prefecture: string | null;
  postal_code: string | null;
  address1: string | null;
  address2: string | null;
  tel: string | null;
  email: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/** ログイン中ユーザーの店舗一覧（通常1件）を返す */
export async function listStores(): Promise<Store[]> {
  return apiFetch<Store[]>("/api/v1/stores");
}

export async function getStore(storeId: string): Promise<Store> {
  return apiFetch<Store>(`/api/v1/stores/${storeId}`);
}
