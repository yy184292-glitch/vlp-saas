"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Numpad, useNumpad } from "@/components/ui/numpad";
import {
  getWorkReport,
  updateWorkReportItem,
  addWorkReportItem,
  deleteWorkReportItem,
  completeWorkReport,
  listWorkMasters,
  type WorkReport,
  type WorkReportItem,
  type WorkMaster,
} from "@/lib/api";

interface MaterialRow {
  id: string;
  savedId?: string;
  item_name: string;
  unit_price: string;
  quantity: string;
  memo: string;
}

function fmtYen(n: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(n);
}

function totalMaterials(rows: MaterialRow[]) {
  return rows.reduce((s, r) => s + Number(r.unit_price || 0) * Number(r.quantity || 0), 0);
}

function totalWork(items: WorkReportItem[]) {
  return items
    .filter((i) => i.item_type === "work")
    .reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);
}

export default function WorkReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [report, setReport] = React.useState<WorkReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [workMasters, setWorkMasters] = React.useState<WorkMaster[]>([]);
  const [showWorkPicker, setShowWorkPicker] = React.useState(false);

  const [materials, setMaterials] = React.useState<MaterialRow[]>([]);
  const [savingItem, setSavingItem] = React.useState<string | null>(null);

  const [completing, setCompleting] = React.useState(false);
  const [reportedBy, setReportedBy] = React.useState("");

  const numpad = useNumpad();

  React.useEffect(() => {
    (async () => {
      try {
        const [r, wm] = await Promise.all([getWorkReport(id), listWorkMasters()]);
        setReport(r);
        const mats: MaterialRow[] = r.items
          .filter((i) => i.item_type === "material")
          .map((i) => ({
            id: i.id,
            savedId: i.id,
            item_name: i.item_name,
            unit_price: String(i.unit_price),
            quantity: String(i.quantity),
            memo: i.memo ?? "",
          }));
        setMaterials(mats);
        setWorkMasters(wm);
      } catch {
        setError("作業報告書を取得できませんでした");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleCheck = async (item: WorkReportItem) => {
    if (!report) return;
    setSavingItem(item.id);
    try {
      const updated = await updateWorkReportItem(report.id, item.id, {
        is_checked: !item.is_checked,
      });
      setReport((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev
      );
    } finally {
      setSavingItem(null);
    }
  };

  const addWorkItem = async (master: WorkMaster) => {
    if (!report) return;
    setShowWorkPicker(false);
    const rate = master.rates[0];
    const newItem = await addWorkReportItem(report.id, {
      work_master_id: master.id,
      item_name: master.work_name,
      item_type: "work",
      quantity: 1,
      unit_price: rate?.price ?? 0,
      duration_minutes: rate?.duration_minutes ?? null,
    });
    setReport((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : prev));
  };

  const addMaterialRow = () => {
    setMaterials((prev) => [
      ...prev,
      { id: crypto.randomUUID(), item_name: "", unit_price: "0", quantity: "1", memo: "" },
    ]);
  };

  const updateMaterialField = (rowId: string, field: keyof MaterialRow, val: string) => {
    setMaterials((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)));
  };

  const saveMaterialRow = async (row: MaterialRow) => {
    if (!report || !row.item_name.trim()) return;
    setSavingItem(row.id);
    try {
      if (row.savedId) {
        await updateWorkReportItem(report.id, row.savedId, {
          item_name: row.item_name,
          unit_price: Number(row.unit_price),
          quantity: Number(row.quantity),
          memo: row.memo || null,
        });
      } else {
        const created = await addWorkReportItem(report.id, {
          item_name: row.item_name,
          item_type: "material",
          quantity: Number(row.quantity),
          unit_price: Number(row.unit_price),
          memo: row.memo || null,
        });
        setMaterials((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, savedId: created.id } : r))
        );
        setReport((prev) => (prev ? { ...prev, items: [...prev.items, created] } : prev));
      }
    } finally {
      setSavingItem(null);
    }
  };

  const removeMaterialRow = async (row: MaterialRow) => {
    if (!report) return;
    if (row.savedId) {
      await deleteWorkReportItem(report.id, row.savedId);
      setReport((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== row.savedId) } : prev
      );
    }
    setMaterials((prev) => prev.filter((r) => r.id !== row.id));
  };

  const handleComplete = async () => {
    if (!report) return;
    setCompleting(true);
    try {
      const updated = await completeWorkReport(report.id, {
        reported_by: reportedBy || undefined,
      });
      setReport(updated);
      router.push("/work-orders/" + report.id + "/invoice");
    } catch {
      setError("完了報告に失敗しました");
    } finally {
      setCompleting(false);
    }
  };

  const workItems = report?.items.filter((i) => i.item_type === "work") ?? [];
  const allChecked = workItems.length > 0 && workItems.every((i) => i.is_checked);
  const workTotal = report ? totalWork(report.items) : 0;
  const materialTotal = totalMaterials(materials);
  const grandTotal = workTotal + materialTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-muted-foreground text-lg">
        読み込み中...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-lg">{error ?? "不明なエラー"}</p>
        <Button asChild variant="outline">
          <Link href="/work-orders">戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/work-orders">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">作業報告書</h1>
            {report.title && <p className="text-sm text-muted-foreground">{report.title}</p>}
          </div>
        </div>
        <Badge
          variant={report.status === "completed" ? "default" : "secondary"}
          className="text-base px-3 py-1"
        >
          {report.status === "completed" ? "完了" : "作業中"}
        </Badge>
      </div>

      {/* Vehicle info */}
      {report.vehicle_category && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="py-4 text-base">
            <span className="text-muted-foreground text-sm block">車種カテゴリ</span>
            <p className="font-semibold text-lg">{report.vehicle_category}</p>
          </CardContent>
        </Card>
      )}

      {/* Work checklist */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">作業チェックリスト</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-base gap-1 px-4"
              onClick={() => setShowWorkPicker(!showWorkPicker)}
              disabled={report.status === "completed"}
            >
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardHeader>

        {showWorkPicker && (
          <CardContent className="pt-0 pb-3">
            <div className="rounded-xl border bg-slate-50 max-h-64 overflow-y-auto divide-y">
              {workMasters
                .filter((m) => m.is_active)
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addWorkItem(m)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors"
                  >
                    <span className="font-medium text-base">{m.work_name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{m.work_category}</span>
                  </button>
                ))}
            </div>
          </CardContent>
        )}

        <CardContent className="pt-0 space-y-2">
          {workItems.length === 0 && (
            <p className="text-muted-foreground text-center py-6 text-base">
              作業項目がありません
            </p>
          )}
          {workItems.map((item) => (
            <div
              key={item.id}
              onClick={() => report.status !== "completed" && toggleCheck(item)}
              className={[
                "rounded-xl border-2 p-4 transition-all select-none",
                item.is_checked
                  ? "bg-green-50 border-green-300"
                  : "bg-white border-slate-200 hover:border-slate-300",
                savingItem === item.id ? "opacity-60 pointer-events-none" : "cursor-pointer",
                report.status === "completed" ? "cursor-default" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {item.is_checked ? (
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  ) : (
                    <Circle className="h-7 w-7 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={"text-lg font-medium " + (item.is_checked ? "line-through text-green-700" : "")}
                  >
                    {item.item_name}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    {item.duration_minutes != null && <span>{item.duration_minutes}分</span>}
                    {Number(item.unit_price) > 0 && <span>{fmtYen(Number(item.unit_price))}</span>}
                  </div>
                  {item.memo && <p className="mt-1 text-sm text-slate-600">{item.memo}</p>}
                </div>
                {item.is_checked && (
                  <Badge className="bg-green-600 text-xs shrink-0">完了</Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Additional materials */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">追加部材</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-base gap-1 px-4"
              onClick={addMaterialRow}
              disabled={report.status === "completed"}
            >
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {materials.length === 0 && (
            <p className="text-muted-foreground text-center py-6 text-base">部材なし</p>
          )}
          {materials.map((row) => (
            <div key={row.id} className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="部材名"
                  value={row.item_name}
                  onChange={(e) => updateMaterialField(row.id, "item_name", e.target.value)}
                  onBlur={() => saveMaterialRow(row)}
                  readOnly={report.status === "completed"}
                  className="flex-1 rounded-lg border px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px]"
                />
                <button
                  type="button"
                  onClick={() => removeMaterialRow(row)}
                  disabled={report.status === "completed"}
                  className="text-red-400 hover:text-red-600 p-2 min-w-[48px] disabled:opacity-40"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">単価</label>
                  <button
                    type="button"
                    onClick={() =>
                      numpad.open("mp-" + row.id, row.unit_price, (v) => {
                        updateMaterialField(row.id, "unit_price", v);
                        saveMaterialRow({ ...row, unit_price: v });
                      })
                    }
                    disabled={report.status === "completed"}
                    className="w-full rounded-lg border px-3 py-3 text-base text-right bg-white hover:bg-slate-50 min-h-[48px] disabled:opacity-60"
                  >
                    {"¥" + Number(row.unit_price).toLocaleString()}
                  </button>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">個数</label>
                  <button
                    type="button"
                    onClick={() =>
                      numpad.open("mq-" + row.id, row.quantity, (v) => {
                        updateMaterialField(row.id, "quantity", v);
                        saveMaterialRow({ ...row, quantity: v });
                      })
                    }
                    disabled={report.status === "completed"}
                    className="w-full rounded-lg border px-3 py-3 text-base text-right bg-white hover:bg-slate-50 min-h-[48px] disabled:opacity-60"
                  >
                    {row.quantity}
                  </button>
                </div>
              </div>
              <div className="text-right text-base font-medium text-slate-700">
                {"小計: " + fmtYen(Number(row.unit_price) * Number(row.quantity))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-5 space-y-3 text-base">
          <div className="flex justify-between">
            <span className="text-muted-foreground">作業工賃合計</span>
            <span className="font-medium">{fmtYen(workTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">部材合計</span>
            <span className="font-medium">{fmtYen(materialTotal)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>小計（税抜）</span>
            <span>{fmtYen(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>消費税（10%）</span>
            <span>{fmtYen(Math.round(grandTotal * 0.1))}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-blue-700">
            <span>合計（税込）</span>
            <span>{fmtYen(Math.round(grandTotal * 1.1))}</span>
          </div>
        </CardContent>
      </Card>

      {/* Reporter */}
      {report.status !== "completed" && (
        <div>
          <label className="text-base font-medium block mb-2">担当者名</label>
          <input
            type="text"
            placeholder="例: 山田 太郎"
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[52px]"
          />
        </div>
      )}

      {/* Fixed bottom action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t shadow-lg">
        {report.status !== "completed" ? (
          <>
            {!allChecked && workItems.length > 0 && (
              <p className="text-center text-sm text-muted-foreground mb-2">
                全ての作業をチェックすると完了報告できます
              </p>
            )}
            <Button
              onClick={handleComplete}
              disabled={!allChecked || completing}
              className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {completing ? "処理中..." : "完了報告"}
            </Button>
          </>
        ) : (
          <Button asChild className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700">
            <Link href={"/work-orders/" + report.id + "/invoice"}>見積/請求書を確認</Link>
          </Button>
        )}
      </div>

      {/* Numpad */}
      {numpad.activeField && (
        <Numpad
          value={numpad.tempValue}
          onChange={numpad.setTempValue}
          onConfirm={numpad.confirm}
          onClose={numpad.close}
        />
      )}
    </div>
  );
}
