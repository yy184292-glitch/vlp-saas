// app/_components/cars/cars-ui.ts
import type { Car } from "@/lib/api";

export type CarStatusTone = "good" | "warn" | "bad" | "muted" | "info";

export type CarCardVM = {
  id: string;
  href: string;

  title: string;        // 車種（make/model/grade）
  statusText: string;   // 状態（表示文字）
  statusTone: CarStatusTone;

  regNoText: string;    // 登録番号（表示文字）
  thumbUrl: string | null;

  metaLine: string;     // 補助情報（stock/vin など）
};

function formatText(v: string | null | undefined) {
  return v && v.trim() ? v : "-";
}

function joinNonEmpty(parts: Array<string | null | undefined>): string {
  return parts
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * 状態の “色味” 判定
 * - ここだけ触れば全UIに反映される
 */
export function statusTone(status: string | null | undefined): CarStatusTone {
  const s = (status ?? "").toLowerCase();
  if (!s) return "muted";
  if (["available", "in_stock", "instock", "active"].includes(s)) return "good";
  if (["reserved", "hold", "pending"].includes(s)) return "warn";
  if (["trouble", "issue", "ng", "error"].includes(s)) return "bad";
  if (["sold", "inactive", "archived"].includes(s)) return "muted";
  return "info";
}

/**
 * サムネURLの取得（将来の拡張ポイント）
 * - APIの返し方が変わっても UI 側が死なないように吸収する
 */
export function getThumbUrl(car: Car): string | null {
  const anyCar = car as any;
  const url =
    anyCar.thumbnail_url ??
    anyCar.thumbnailUrl ??
    anyCar.thumb_url ??
    anyCar.thumbUrl ??
    anyCar.image_url ??
    anyCar.imageUrl ??
    null;

  return typeof url === "string" && url.trim() ? url : null;
}

export function getCarTitle(car: Car): string {
  return joinNonEmpty([car.make ?? car.maker, car.model, car.grade]) || "車両";
}

export function getRegNoText(car: Car): string {
  // “登録番号” ルールが固まったらここを変更する
  return formatText(car.carNumber);
}

export function toCarCardVM(car: Car): CarCardVM {
  return {
    id: car.id,
    href: `/cars/${encodeURIComponent(car.id)}`,
    title: getCarTitle(car),
    statusText: formatText(car.status),
    statusTone: statusTone(car.status),
    regNoText: getRegNoText(car),
    thumbUrl: getThumbUrl(car),
    metaLine: `stock：${formatText(car.stockNo)} / vin：${formatText(car.vin)}`,
  };
}

/**
 * tone -> tailwind class
 * - UIデザイン変えたくなったらここだけ
 */
export function toneClass(tone: CarStatusTone): string {
  switch (tone) {
    case "good":
      return "text-emerald-600";
    case "warn":
      return "text-amber-600";
    case "bad":
      return "text-rose-600";
    case "muted":
      return "text-muted-foreground";
    case "info":
    default:
      return "text-sky-600";
  }
}