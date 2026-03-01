// app/_components/cars/carPresenters.ts
import type { Car } from "@/lib/api";

/**
 * 将来の拡張ポイント：
 * - DBに thumbnail_url を持つ
 * - S3 / R2 の署名URLを返すAPIを作る
 * - ローカルの「別フォルダ写真」から解決する（管理画面のみ）など
 */
export type CarThumbResolver = (car: Car) => string | null;

export const defaultThumbResolver: CarThumbResolver = (_car) => null;

export function formatText(v: string | null | undefined) {
  return v && v.trim() ? v : "-";
}

export function carTitle(c: Car): string {
  const make = formatText(c.make ?? c.maker);
  const model = formatText(c.model);
  const grade = c.grade ? ` ${c.grade}` : "";
  return `${make} ${model}${grade}`.trim();
}

/**
 * “状態”は運用で増えるので、ここだけ触れば反映される形にしておく
 */
export type StatusTone = "muted" | "good" | "warn" | "bad" | "info";

export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? "").toLowerCase();
  if (!s) return "muted";
  if (["available", "in_stock", "instock", "active"].includes(s)) return "good";
  if (["reserved", "hold", "pending"].includes(s)) return "warn";
  if (["sold", "inactive", "archived"].includes(s)) return "muted";
  if (["trouble", "issue", "ng", "error"].includes(s)) return "bad";
  return "info";
}

export function statusClassName(tone: StatusTone): string {
  switch (tone) {
    case "good":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "bad":
      return "text-rose-600";
    case "info":
      return "text-sky-600";
    default:
      return "text-muted-foreground";
  }
}