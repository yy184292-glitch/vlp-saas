"use client";

import * as React from "react";
import { Palette, RotateCcw, Save, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─── 型 ──────────────────────────────────────────────────────

type CarStatus = {
  id: string;
  store_id: string;
  name: string;
  color: string;
  sort_order: number;
};

// ─── デフォルトカラー ─────────────────────────────────────────

const DEFAULT_COLORS: Record<string, string> = {
  在庫: "#DCFCE7",
  商談中: "#FEF9C3",
  整備中: "#DBEAFE",
  売約: "#FFEDD5",
  納車済: "#E5E7EB",
};

function getDefaultColor(name: string): string {
  return DEFAULT_COLORS[name] ?? "#E5E7EB";
}

// ─── カードプレビュー ─────────────────────────────────────────

function CardPreview({ name, color }: { name: string; color: string }) {
  // テキスト色を背景色の輝度から決定
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? "#1a1a1a" : "#ffffff";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 8,
        border: `3px solid ${color}`,
        background: "#2a2a2a",
        minWidth: 200,
      }}
    >
      {/* 左ボーダー強調（CarCard のスタイルに合わせたプレビュー） */}
      <div
        style={{
          width: 4,
          height: 32,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>サンプル車両名</div>
        <div style={{ marginTop: 4 }}>
          <span
            style={{
              display: "inline-block",
              padding: "1px 8px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 700,
              background: color + "33",
              color: color,
              border: `1px solid ${color}55`,
            }}
          >
            {name}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 1ステータス行 ────────────────────────────────────────────

function StatusRow({
  status,
  color,
  onChange,
  onReset,
}: {
  status: CarStatus;
  color: string;
  onChange: (id: string, color: string) => void;
  onReset: (id: string) => void;
}) {
  const isDirty = color !== status.color;
  const defaultColor = getDefaultColor(status.name);
  const isDefault = color === defaultColor;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 16px",
        background: "#2a2a2a",
        borderRadius: 10,
        border: `1px solid ${isDirty ? "#f59e0b55" : "#3a3a3a"}`,
      }}
    >
      {/* ステータス名 + カラーピッカー */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(status.id, e.target.value)}
            style={{
              width: 36, height: 36, borderRadius: 8, border: "2px solid #555",
              cursor: "pointer", padding: 2, background: "transparent",
            }}
            title="カラーを選択"
          />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{status.name}</div>
          <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>{color}</div>
        </div>
      </div>

      {/* プレビュー */}
      <CardPreview name={status.name} color={color} />

      {/* リセット */}
      <button
        type="button"
        onClick={() => onReset(status.id)}
        disabled={isDefault}
        style={{
          background: "transparent", border: "none", cursor: isDefault ? "default" : "pointer",
          color: isDefault ? "#444" : "#888", padding: 6, display: "flex", alignItems: "center", gap: 4,
          fontSize: 11, borderRadius: 6,
        }}
        title="デフォルトに戻す"
      >
        <RotateCcw size={12} />
        デフォルト
      </button>
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────────

export default function CarStatusColorsPage() {
  const [statuses, setStatuses] = React.useState<CarStatus[]>([]);
  const [colorMap, setColorMap] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<CarStatus[]>("/api/v1/masters/car-statuses");
        setStatuses(data ?? []);
        const map: Record<string, string> = {};
        for (const s of data ?? []) map[s.id] = s.color;
        setColorMap(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (id: string, color: string) => {
    setColorMap((prev) => ({ ...prev, [id]: color }));
  };

  const handleReset = (id: string) => {
    const status = statuses.find((s) => s.id === id);
    if (!status) return;
    setColorMap((prev) => ({ ...prev, [id]: getDefaultColor(status.name) }));
  };

  const handleResetAll = () => {
    const map: Record<string, string> = {};
    for (const s of statuses) map[s.id] = getDefaultColor(s.name);
    setColorMap(map);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // 変更があったステータスだけ PUT
      const changed = statuses.filter((s) => colorMap[s.id] !== s.color);
      await Promise.all(
        changed.map((s) =>
          apiFetch(`/api/v1/masters/car-statuses/${s.id}`, {
            method: "PUT",
            body: { name: s.name, color: colorMap[s.id], sort_order: s.sort_order },
          })
        )
      );
      // ローカル状態も更新
      setStatuses((prev) =>
        prev.map((s) => ({ ...s, color: colorMap[s.id] ?? s.color }))
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  };

  const hasDirty = statuses.some((s) => colorMap[s.id] !== s.color);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Palette className="h-5 w-5" />
        ステータスカラー設定
      </div>
      <div className="text-sm text-muted-foreground">
        車両ステータスのカラーをカスタマイズできます。プレビューで確認してから保存してください。
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <>
          <Separator />
          <div className="space-y-2">
            {statuses.map((s) => (
              <StatusRow
                key={s.id}
                status={s}
                color={colorMap[s.id] ?? s.color}
                onChange={handleChange}
                onReset={handleReset}
              />
            ))}
            {statuses.length === 0 && (
              <div className="text-sm text-muted-foreground">ステータスがありません</div>
            )}
          </div>

          <Separator />

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving || !hasDirty}>
              <Save size={13} className="mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button variant="secondary" onClick={handleResetAll}>
              <RotateCcw size={13} className="mr-1" />
              すべてデフォルトに戻す
            </Button>
            {saved && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "#10b981" }}>
                <CheckCircle size={14} /> 保存しました
              </div>
            )}
            {hasDirty && !saved && (
              <div className="text-xs text-muted-foreground">未保存の変更があります</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
