import { apiFetch } from "./core";

export interface ImportRowResult {
  row: number;
  status: "ok" | "error";
  reason: string | null;
  data: Record<string, string>;
}

export interface ImportResult {
  total: number;
  valid: number;
  errors: number;
  imported: number;
  rows: ImportRowResult[];
}

/** テンプレート CSV をダウンロード（ブラウザ経由）*/
export function downloadTemplate(type: "cars" | "customers") {
  const name =
    type === "cars" ? "car_import_template.csv" : "customer_import_template.csv";
  const a = document.createElement("a");
  a.href = `/api/v1/import/template/${type}`;
  a.download = name;
  a.click();
}

/** CSV をアップロードしてプレビュー／インポート */
export async function uploadImportCsv(
  type: "cars" | "customers",
  file: File,
  dryRun: boolean
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ImportResult>(
    `/api/v1/import/${type}?dry_run=${dryRun}`,
    { method: "POST", body: formData }
  );
}
