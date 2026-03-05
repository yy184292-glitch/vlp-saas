"use client";

import * as React from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Car,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadTemplate, uploadImportCsv, type ImportResult, type ImportRowResult } from "@/lib/api";

// ─── タブ定義 ─────────────────────────────────────────────────────────────────

type TabType = "cars" | "customers";

const TABS: { key: TabType; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    key: "cars",
    label: "車両データ",
    icon: <Car className="h-5 w-5" />,
    desc: "管理番号・メーカー・車種・車体番号 など",
  },
  {
    key: "customers",
    label: "顧客データ",
    icon: <Users className="h-5 w-5" />,
    desc: "顧客名・住所・電話番号 など",
  },
];

// ─── ステータスバッジ ──────────────────────────────────────────────────────────

function RowBadge({ status }: { status: "ok" | "error" }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 text-xs font-semibold">
        <CheckCircle2 className="h-3 w-3" />
        正常
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-xs font-semibold">
      <XCircle className="h-3 w-3" />
      エラー
    </span>
  );
}

// ─── サマリーカード ────────────────────────────────────────────────────────────

function Summary({ result, imported }: { result: ImportResult; imported: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border bg-slate-50 p-3 text-center">
        <p className="text-xs text-slate-500">合計行数</p>
        <p className="text-2xl font-bold">{result.total}</p>
      </div>
      <div className="rounded-xl border bg-green-50 p-3 text-center">
        <p className="text-xs text-green-700">正常行</p>
        <p className="text-2xl font-bold text-green-700">{result.valid}</p>
      </div>
      <div className="rounded-xl border bg-red-50 p-3 text-center">
        <p className="text-xs text-red-700">エラー行</p>
        <p className="text-2xl font-bold text-red-700">{result.errors}</p>
      </div>
      {imported && (
        <div className="rounded-xl border bg-blue-50 p-3 text-center">
          <p className="text-xs text-blue-700">登録済み</p>
          <p className="text-2xl font-bold text-blue-700">{result.imported}</p>
        </div>
      )}
    </div>
  );
}

// ─── プレビューテーブル ────────────────────────────────────────────────────────

function PreviewTable({ rows }: { rows: ImportRowResult[] }) {
  const preview = rows.slice(0, 10);
  // データのキー一覧（最初の行から取得）
  const cols = preview.length > 0 ? Object.keys(preview[0].data) : [];

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 text-left">
            <th className="border-b px-3 py-2 font-semibold whitespace-nowrap">行</th>
            <th className="border-b px-3 py-2 font-semibold whitespace-nowrap">状態</th>
            {cols.map((c) => (
              <th key={c} className="border-b px-3 py-2 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
            <th className="border-b px-3 py-2 font-semibold">エラー理由</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((r) => (
            <tr
              key={r.row}
              className={r.status === "ok" ? "bg-green-50/60" : "bg-red-50/60"}
            >
              <td className="border-b px-3 py-2 text-slate-500">{r.row}</td>
              <td className="border-b px-3 py-2">
                <RowBadge status={r.status} />
              </td>
              {cols.map((c) => (
                <td key={c} className="border-b px-3 py-2 whitespace-nowrap max-w-[120px] truncate">
                  {r.data[c] ?? ""}
                </td>
              ))}
              <td className="border-b px-3 py-2 text-red-600 whitespace-nowrap">
                {r.reason ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && (
        <p className="text-xs text-slate-500 px-3 py-2 bg-slate-50">
          ※ 先頭10件のみ表示（全{rows.length}件）
        </p>
      )}
    </div>
  );
}

// ─── ドロップゾーン ────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  disabled,
}: {
  onFile: (f: File) => void;
  disabled: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-all cursor-pointer",
        dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-slate-400",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      <Upload className="h-10 w-10 text-slate-400" />
      <p className="text-base font-semibold text-slate-600">
        CSVファイルをドロップ、またはクリックして選択
      </p>
      <p className="text-sm text-slate-400">UTF-8 / Shift-JIS 対応 ・ 最大 5MB</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

type Phase = "idle" | "preview" | "done";

export default function ImportPage() {
  const [tab, setTab] = React.useState<TabType>("cars");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportResult | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // タブ切り替え時にリセット
  const switchTab = (t: TabType) => {
    setTab(t);
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  // ファイル選択 → プレビュー
  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setPhase("idle");
    setPreview(null);
    setLoading(true);
    try {
      const res = await uploadImportCsv(tab, f, true);
      setPreview(res);
      setPhase("preview");
    } catch {
      setError("CSVの読み込みに失敗しました。ファイルとフォーマットを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  // 実インポート
  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadImportCsv(tab, file, false);
      setResult(res);
      setPhase("done");
    } catch {
      setError("インポートに失敗しました。再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  // リセット
  const handleReset = () => {
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">CSVインポート</h1>
        <p className="text-sm text-muted-foreground mt-1">
          車両データ・顧客データを CSV で一括登録できます
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-3 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={[
              "flex items-center gap-2 rounded-xl border-2 px-5 py-3 font-semibold transition-all text-sm",
              tab === t.key
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            ].join(" ")}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* テンプレートダウンロード */}
      <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-5 py-4">
        <FileText className="h-5 w-5 text-slate-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">テンプレートをダウンロード</p>
          <p className="text-xs text-slate-500">
            {TABS.find((t) => t.key === tab)?.desc}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadTemplate(tab)}
          className="gap-1.5 shrink-0"
        >
          <Download className="h-4 w-4" />
          ダウンロード
        </Button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Phase: idle ── */}
      {phase === "idle" && (
        <DropZone onFile={handleFile} disabled={loading} />
      )}

      {/* ── Phase: preview ── */}
      {phase === "preview" && preview && (
        <div className="space-y-5">
          {/* ファイル名 */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileText className="h-4 w-4" />
            <span className="font-medium">{file?.name}</span>
            <button
              onClick={handleReset}
              className="ml-auto text-xs text-blue-600 underline hover:no-underline"
            >
              別のファイルを選択
            </button>
          </div>

          {/* サマリー */}
          <Summary result={preview} imported={false} />

          {/* プレビューテーブル */}
          <PreviewTable rows={preview.rows} />

          {/* インポート実行ボタン */}
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={loading}
              className="flex-1 sm:flex-none h-12"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || preview.valid === 0}
              className="flex-1 sm:flex-none h-12 font-bold bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Upload className="h-5 w-5" />
              {loading
                ? "登録中..."
                : `インポート実行（${preview.valid}件登録、${preview.errors}件スキップ）`}
            </Button>
          </div>

          {preview.valid === 0 && (
            <p className="text-sm text-red-600">
              正常行が0件のためインポートできません。CSVを修正してください。
            </p>
          )}
        </div>
      )}

      {/* ── Phase: done ── */}
      {phase === "done" && result && (
        <div className="space-y-5">
          {/* 完了メッセージ */}
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800">インポート完了</p>
              <p className="text-sm text-green-700">
                {result.imported}件を登録しました。{result.errors > 0 && `${result.errors}件はスキップされました。`}
              </p>
            </div>
          </div>

          {/* サマリー */}
          <Summary result={result} imported={true} />

          {/* エラー行があれば詳細表示 */}
          {result.errors > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-700">スキップされた行の詳細</h3>
              <PreviewTable rows={result.rows.filter((r) => r.status === "error")} />
            </div>
          )}

          {/* リセット */}
          <Button onClick={handleReset} variant="outline" className="w-full h-12">
            続けてインポートする
          </Button>
        </div>
      )}
    </div>
  );
}
