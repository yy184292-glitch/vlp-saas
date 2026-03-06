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
 * "状態"は運用で増えるので、ここだけ触れば反映される形にしておく
 */
export type StatusTone = "muted" | "good" | "warn" | "sold" | "maintenance" | "bad" | "info";

export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? "").toLowerCase();
  if (!s) return "muted";
  // 在庫あり・販売中
  if (["available", "in_stock", "instock", "active", "販売中", "在庫あり"].includes(s)) return "good";
  // 商談中
  if (["reserved", "hold", "pending", "商談中"].includes(s)) return "warn";
  // 売約済み
  if (["sold", "売約済み", "売約済", "完売"].includes(s)) return "sold";
  // 整備中
  if (["maintenance", "整備中", "repair", "in_repair"].includes(s)) return "maintenance";
  // 入庫待ち・非アクティブ
  if (["inactive", "archived", "入庫待ち", "incoming", "pending_arrival"].includes(s)) return "muted";
  // エラー・問題
  if (["trouble", "issue", "ng", "error"].includes(s)) return "bad";
  return "info";
}

/** カードのテキスト色クラス（ダークテーマ対応） */
export function statusClassName(tone: StatusTone): string {
  switch (tone) {
    case "good":        return "text-emerald-400";
    case "warn":        return "text-amber-400";
    case "sold":        return "text-emerald-400";
    case "maintenance": return "text-orange-400";
    case "bad":         return "text-rose-400";
    case "info":        return "text-sky-400";
    default:            return "text-gray-400";
  }
}

/**
 * カード左ボーダークラス（商談中・売約済み・整備中・入庫待ちを強調）
 * Tailwind の border-l-4 を利用
 */
export function cardBorderClass(tone: StatusTone): string {
  switch (tone) {
    case "warn":        return "border-l-4 border-l-amber-400";
    case "sold":        return "border-l-4 border-l-emerald-500";
    case "maintenance": return "border-l-4 border-l-orange-500";
    case "muted":       return "border-l-4 border-l-gray-600";
    default:            return "";
  }
}

/**
 * ステータスバッジのインラインスタイル（小型バッジ用）
 */
export function statusBadgeStyle(tone: StatusTone): React.CSSProperties {
  switch (tone) {
    case "warn":
      return { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" };
    case "sold":
      return { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" };
    case "maintenance":
      return { background: "rgba(251,146,60,0.15)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.35)" };
    case "muted":
      return { background: "rgba(156,163,175,0.15)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.3)" };
    case "good":
      return { background: "rgba(52,211,153,0.1)", color: "#34d399" };
    case "bad":
      return { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.35)" };
    default:
      return { background: "rgba(56,189,248,0.1)", color: "#38bdf8" };
  }
}
