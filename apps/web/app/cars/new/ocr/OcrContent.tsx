"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createCar, listCarStatuses, ocrShaken, type CarStatus, type ShakenOcrResult } from "@/lib/api";

function toNumberOrNull(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  /** 車両作成後に car.id を渡すコールバック */
  onCreated?: (carId: string) => void;
};

export default function NewCarOcrContent({ onCreated }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ocr, setOcr] = useState<ShakenOcrResult | null>(null);

  const [statuses, setStatuses] = useState<CarStatus[]>([]);
  const [status, setStatus] = useState<string>("");

  // editable fields
  const [maker, setMaker] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [modelCode, setModelCode] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [stockNo, setStockNo] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await listCarStatuses();
        const active = list.filter((x) => x.is_active !== false);
        setStatuses(active);
        if (!status && active.length > 0) setStatus(active[0].name);
      } catch {
        // 取得できなくても登録自体は可能
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runOcr(f: File) {
    setLoading(true);
    setError(null);
    setOcr(null);

    try {
      const res = await ocrShaken(f);
      setOcr(res);

      const fields = res.fields ?? {};
      setMaker(String(fields.maker ?? "").trim());
      setModel(String(fields.model ?? "").trim());
      setYear(fields.year != null ? String(fields.year) : "");
      setVin(String(fields.vin ?? "").trim());
      setModelCode(String(fields.model_code ?? "").trim());
      setCarNumber(String(fields.car_number ?? "").trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCRに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function onPickFile(f: File | null) {
    if (!f) return;
    setFile(f);
    void runOcr(f);
  }

  function openFileDialog() {
    inputRef.current?.click();
  }

  async function onCreate() {
    setLoading(true);
    setError(null);

    try {
      const car = await createCar({
        stock_no: stockNo || null,
        status: status || null,
        maker: maker || null,
        model: model || null,
        year: toNumberOrNull(year),
        vin: vin || null,
        model_code: modelCode || null,
        car_number: carNumber || null,
      });
      onCreated?.(car.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const canCreate = useMemo(() => {
    return (maker.trim() || model.trim()) && !loading;
  }, [maker, model, loading]);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</div>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">車検証ファイル</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,image/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />

          <div
            className="rounded-xl border border-dashed p-6 text-center text-sm"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0] ?? null;
              if (f) onPickFile(f);
            }}
          >
            <div className="font-medium">ここにドラッグ＆ドロップ</div>
            <div className="mt-1 text-muted-foreground">または</div>
            <div className="mt-3">
              <Button onClick={openFileDialog} disabled={loading}>
                ファイルを選択
              </Button>
            </div>
            {file ? <div className="mt-3 text-xs text-muted-foreground">{file.name}</div> : null}
          </div>

          {loading ? <div className="text-sm text-muted-foreground">処理中…</div> : null}

          {ocr?.text ? (
            <details className="rounded-lg border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">OCRテキスト（確認）</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{ocr.text}</pre>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">自動入力（編集可能）</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>ステータス</Label>
            {statuses.length > 0 ? (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="在庫" />
            )}
          </div>

          <div className="space-y-1">
            <Label>在庫No</Label>
            <Input value={stockNo} onChange={(e) => setStockNo(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>メーカー</Label>
            <Input value={maker} onChange={(e) => setMaker(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>車種</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>年式</Label>
            <Input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" />
          </div>

          <div className="space-y-1">
            <Label>登録番号</Label>
            <Input value={carNumber} onChange={(e) => setCarNumber(e.target.value)} placeholder="品川 300 あ 12-34" />
          </div>

          <div className="space-y-1">
            <Label>車台番号（VIN）</Label>
            <Input value={vin} onChange={(e) => setVin(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>型式</Label>
            <Input value={modelCode} onChange={(e) => setModelCode(e.target.value)} />
          </div>

          <div className="md:col-span-2 flex justify-end pt-2">
            <Button onClick={onCreate} disabled={!canCreate}>
              {loading ? "作成中…" : "この内容で車両を作成"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
