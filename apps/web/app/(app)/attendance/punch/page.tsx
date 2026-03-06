"use client";

import * as React from "react";
import { MapPin, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

import {
  getTodayAttendance,
  clockIn,
  clockOut,
  getGpsLocation,
  calcWorkHours,
  type Attendance,
} from "@/lib/api/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── ユーティリティ ──────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDate(d: Date): string {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
}

function useClock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ─── GPS バナー ──────────────────────────────────────────────

function GpsBanner({
  gpsState,
}: {
  gpsState: "idle" | "loading" | "ok" | "denied";
}) {
  if (gpsState === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#f59e0b" }}>
        <Loader2 size={12} className="animate-spin" />
        位置情報を取得中...
      </div>
    );
  }
  if (gpsState === "denied") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888" }}>
        <AlertTriangle size={12} />
        位置情報なしで打刻します（任意）
      </div>
    );
  }
  if (gpsState === "ok") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#10b981" }}>
        <MapPin size={12} />
        位置情報を取得しました
      </div>
    );
  }
  return null;
}

// ─── メインページ ────────────────────────────────────────────

export default function PunchPage() {
  const now = useClock();
  const [record, setRecord] = React.useState<Attendance | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [gpsState, setGpsState] = React.useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [gpsData, setGpsData] = React.useState<{ lat?: number; lng?: number; address?: string }>({});

  // 今日の打刻状況を読み込む
  React.useEffect(() => {
    void (async () => {
      try {
        const data = await getTodayAttendance();
        setRecord(data);
      } catch {
        setRecord(null);
      }
    })();
  }, []);

  const fetchGps = async (): Promise<{ lat?: number; lng?: number; address?: string }> => {
    setGpsState("loading");
    const result = await getGpsLocation();
    if (result.ok) {
      setGpsState("ok");
      const data = { lat: result.lat, lng: result.lng, address: result.address };
      setGpsData(data);
      return data;
    } else {
      setGpsState("denied");
      setGpsData({});
      return {};
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    setError(null);
    const geo = await fetchGps();
    try {
      const updated = await clockIn({
        lat: geo.lat ?? null,
        lng: geo.lng ?? null,
        address: geo.address ?? null,
      });
      setRecord(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "打刻に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError(null);
    const geo = await fetchGps();
    try {
      const updated = await clockOut({
        lat: geo.lat ?? null,
        lng: geo.lng ?? null,
        address: geo.address ?? null,
      });
      setRecord(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "打刻に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const isLoaded = record !== undefined;
  const hasClockedIn = isLoaded && record !== null && record.clock_in !== null;
  const hasClockedOut = hasClockedIn && record!.clock_out !== null;

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "32px 16px",
      }}
    >
      {/* 日付・時刻表示 */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, color: "#888", marginBottom: 4 }}>{fmtDate(now)}</div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 2,
            color: "#e0e0e0",
            lineHeight: 1,
          }}
        >
          {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}:
          {String(now.getSeconds()).padStart(2, "0")}
        </div>
      </div>

      {/* 打刻状況カード */}
      {isLoaded && (
        <Card style={{ width: "100%", maxWidth: 360, background: "#2a2a2a", border: "1px solid #3a3a3a" }}>
          <CardContent style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>出勤</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: hasClockedIn ? "#10b981" : "#444",
                  }}
                >
                  {fmtTime(record?.clock_in ?? null)}
                </div>
                {record?.clock_in_address && (
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2, wordBreak: "break-all" }}>
                    <MapPin size={9} style={{ display: "inline", marginRight: 2 }} />
                    {record.clock_in_address.slice(0, 30)}
                  </div>
                )}
              </div>

              <div style={{ width: 1, background: "#3a3a3a", margin: "0 16px" }} />

              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>退勤</div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: hasClockedOut ? "#3b82f6" : "#444",
                  }}
                >
                  {fmtTime(record?.clock_out ?? null)}
                </div>
                {record?.clock_out_address && (
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2, wordBreak: "break-all" }}>
                    <MapPin size={9} style={{ display: "inline", marginRight: 2 }} />
                    {record.clock_out_address.slice(0, 30)}
                  </div>
                )}
              </div>
            </div>

            {hasClockedIn && hasClockedOut && (
              <div style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
                勤務時間: <span style={{ color: "#e0e0e0", fontWeight: 700 }}>
                  {calcWorkHours(record!.clock_in, record!.clock_out)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* GPS状態 */}
      <GpsBanner gpsState={gpsState} />

      {/* エラー */}
      {error && (
        <div
          style={{
            background: "#ef444420", border: "1px solid #ef444460",
            borderRadius: 10, padding: "10px 16px",
            fontSize: 13, color: "#ef4444", maxWidth: 360, width: "100%", textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      {/* 打刻ボタン */}
      {!isLoaded && (
        <div style={{ color: "#888", fontSize: 13 }}>読み込み中...</div>
      )}

      {isLoaded && !hasClockedIn && (
        <Button
          onClick={handleClockIn}
          disabled={loading}
          style={{
            width: 200, height: 64, fontSize: 20, fontWeight: 900,
            borderRadius: 16,
            background: "#10b981",
            color: "#fff",
          }}
        >
          {loading ? <Loader2 size={24} className="animate-spin" /> : "出勤打刻"}
        </Button>
      )}

      {isLoaded && hasClockedIn && !hasClockedOut && (
        <Button
          onClick={handleClockOut}
          disabled={loading}
          style={{
            width: 200, height: 64, fontSize: 20, fontWeight: 900,
            borderRadius: 16,
            background: "#3b82f6",
            color: "#fff",
          }}
        >
          {loading ? <Loader2 size={24} className="animate-spin" /> : "退勤打刻"}
        </Button>
      )}

      {isLoaded && hasClockedOut && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <CheckCircle size={48} color="#10b981" />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e0e0e0" }}>本日の打刻完了</div>
          <div style={{ fontSize: 13, color: "#888" }}>お疲れさまでした</div>
        </div>
      )}
    </div>
  );
}
