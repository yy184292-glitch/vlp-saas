// apps/web/features/cars/carsApi.ts
import { apiFetch } from '@/lib/api';

export type Car = {
  id: string;
  make?: string;
  model?: string;
  year?: number;
};

export async function listCars(): Promise<Car[]> {
  return apiFetch<Car[]>('/cars', {
    method: 'GET',
  });
}

export async function getCar(id: string): Promise<Car> {
  return apiFetch<Car>(`/cars/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}
