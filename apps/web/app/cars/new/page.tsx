"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCar, listCarStatuses, type CarStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect } from "react";
import NewCarOcrContent from "./ocr/OcrContent";

export default function NewCarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrOpen, setOcrOpen] = useState(false);

  // 基本情報
  const [stockNo, setStockNo] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [grade, setGrade] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [vin, setVin] = useState("");
  const [mileage, setMileage] = useState("");
  const [carNumber, setCarNumber] = useState("");

  // 価格
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  // ステータス
  const [statuses, setStatuses] = useState<CarStatus[]>([]);
  const [status, setStatus] = useState("在庫");

  useEffect(() => {
    listCarStatuses()
      .then((list) => {
        const active = list.filter((x) => x.is_active !== false);
        setStatuses(active);
        if (active.length > 0 && !status) setStatus(active[0].name);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parseIntOrNull(v: string): number | null {
    const n = parseInt(v.replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const car = await createCar({
        stock_no: stockNo.trim() || null,
        make: make.trim() || null,
        model: model.trim() || null,
        grade: grade.trim() || null,
        year: parseIntOrNull(year),
        color: color.trim() || null,
        vin: vin.trim() || null,
        mileage: parseIntOrNull(mileage),
        car_number: carNumber.trim() || null,
        purchase_price: parseIntOrNull(purchasePrice),
        sale_price: parseIntOrNull(salePrice),
        status: status || "在庫",
      });
      router.push(`/cars/${car.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { marginTop: 4, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 } as const;
  const labelStyle = { display: "block", fontSize: 12, color: "#6b7280", fontWeight: 600 } as const;
  const rowStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">車両 新規登録</h1>
        <Button variant="outline" onClick={() => setOcrOpen(true)}>
          車検証OCRで作成
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">{error}</div>
      )}

      <div className="space-y-4 rounded-xl border bg-white p-5">
        {/* ステータス */}
        <div>
          <label style={labelStyle}>ステータス</label>
          {statuses.length > 0 ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={inputStyle}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="在庫"
              style={inputStyle}
            />
          )}
        </div>

        {/* 基本情報 */}
        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>在庫No</label>
            <input style={inputStyle} value={stockNo} onChange={(e) => setStockNo(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>車両ナンバー</label>
            <input style={inputStyle} value={carNumber} onChange={(e) => setCarNumber(e.target.value)} placeholder="品川 300 あ 1234" />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>メーカー</label>
            <input style={inputStyle} value={make} onChange={(e) => setMake(e.target.value)} placeholder="トヨタ" />
          </div>
          <div>
            <label style={labelStyle}>車種</label>
            <input style={inputStyle} value={model} onChange={(e) => setModel(e.target.value)} placeholder="プリウス" />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>グレード</label>
            <input style={inputStyle} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Z" />
          </div>
          <div>
            <label style={labelStyle}>年式</label>
            <input style={inputStyle} value={year} onChange={(e) => setYear(e.target.value)} type="number" placeholder="2022" min="1990" max="2030" />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <label style={labelStyle}>色</label>
            <input style={inputStyle} value={color} onChange={(e) => setColor(e.target.value)} placeholder="ホワイトパールクリスタルシャイン" />
          </div>
          <div>
            <label style={labelStyle}>走行距離 (km)</label>
            <input style={inputStyle} value={mileage} onChange={(e) => setMileage(e.target.value)} type="number" placeholder="25000" min="0" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>車台番号 (VIN)</label>
          <input style={inputStyle} value={vin} onChange={(e) => setVin(e.target.value)} placeholder="ZVW505-XXXXXXX" />
        </div>

        {/* 価格 */}
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>価格</div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>仕入価格 (円)</label>
              <input style={inputStyle} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" placeholder="1500000" min="0" />
            </div>
            <div>
              <label style={labelStyle}>販売価格 (円)</label>
              <input style={inputStyle} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} type="number" placeholder="1980000" min="0" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "作成中…" : "作成"}
          </Button>
        </div>
      </div>

      {/* OCR モーダル */}
      <Dialog open={ocrOpen} onOpenChange={setOcrOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>車検証OCRで車両登録</DialogTitle>
          </DialogHeader>
          <NewCarOcrContent
            onCreated={(carId) => {
              setOcrOpen(false);
              router.push(`/cars/${carId}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
