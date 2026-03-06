"use client";

import * as React from "react";
import { ClipboardCheck, MapPin, Pencil, Trash2, X, Check } from "lucide-react";

import {
  listAttendance,
  updateAttendance,
  deleteAttendance,
  calcWorkHours,
  type Attendance,
  type AttendanceUpdate,
} from "@/lib/api/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ─── ユーティリティ ──────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "エラーが発生しました";
}

function StatusBadge({ rec }: { rec: Attendance }) {
  if (rec.clock_out) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "#10b98120", padding: "2px 8px", borderRadius: 6 }}>
        退勤済
      </span>
    );
  }
  if (rec.clock_in) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "#f59e0b20", padding: "2px 8px", borderRadius: 6 }}>
        出勤中
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: "#888", background: "#88888820", padding: "2px 8px", borderRadius: 6 }}>
      未打刻
    </span>
  );
}

// ─── インライン編集フォーム ───────────────────────────────────

function EditRow({
  rec,
  onSave,
  onCancel,
}: {
  rec: Attendance;
  onSave: (updated: Attendance) => void;
  onCancel: () => void;
}) {
  const toLocalDatetime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [clockIn, setClockIn] = React.useState(toLocalDatetime(rec.clock_in));
  const [clockOut, setClockOut] = React.useState(toLocalDatetime(rec.clock_out));
  const [note, setNote] = React.useState(rec.note ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: AttendanceUpdate = {
        clock_in: clockIn ? new Date(clockIn).toISOString() : null,
        clock_out: clockOut ? new Date(clockOut).toISOString() : null,
        note: note || null,
      };
      const updated = await updateAttendance(rec.id, body);
      onSave(updated);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow style={{ background: "#252525" }}>
      <TableCell>{rec.work_date}</TableCell>
      <TableCell style={{ fontSize: 12, color: "#aaa" }}>{rec.user_name ?? rec.user_email ?? "-"}</TableCell>
      <TableCell>
        <Input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="h-7 text-xs w-[180px]" />
      </TableCell>
      <TableCell>
        <Input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="h-7 text-xs w-[180px]" />
      </TableCell>
      <TableCell>-</TableCell>
      <TableCell>
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-7 text-xs w-[150px]" placeholder="メモ" />
        {error && <div className="text-xs text-destructive mt-1">{error}</div>}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#10b981", padding: 4 }}
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── メインページ ────────────────────────────────────────────

export default function AttendancePage() {
  const [items, setItems] = React.useState<Attendance[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [startDate, setStartDate] = React.useState(firstOfMonthIso());
  const [endDate, setEndDate] = React.useState(todayIso());
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAttendance({ start_date: startDate, end_date: endDate, limit: 200 });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  React.useEffect(() => { void reload(); }, [reload]);

  const remove = async (rec: Attendance) => {
    if (!window.confirm(`${rec.work_date} / ${rec.user_name ?? rec.user_email} の記録を削除しますか？`)) return;
    try {
      await deleteAttendance(rec.id);
      setItems((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (e) {
      setError(errMsg(e));
    }
  };

  // ユーザー別サマリー（表示期間内の合計勤務時間）
  const summary = React.useMemo(() => {
    const map = new Map<string, { name: string; days: number; totalMs: number }>();
    for (const r of items) {
      const key = r.user_id;
      const name = r.user_name ?? r.user_email ?? r.user_id;
      const ms =
        r.clock_in && r.clock_out
          ? Math.max(0, new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime())
          : 0;
      const prev = map.get(key) ?? { name, days: 0, totalMs: 0 };
      map.set(key, { name, days: prev.days + 1, totalMs: prev.totalMs + ms });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <ClipboardCheck className="h-5 w-5" />
        勤怠管理
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">開始日</div>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">終了日</div>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-[150px]" />
        </div>
        <Button variant="secondary" onClick={reload}>再読込</Button>
        <span className="text-sm text-muted-foreground self-end">全 {total} 件</span>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {/* ユーザー別サマリー */}
      {summary.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">スタッフ別サマリー（表示期間）</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-4">
              {summary.map((s) => {
                const h = Math.floor(s.totalMs / 3600000);
                const m = Math.floor((s.totalMs % 3600000) / 60000);
                return (
                  <div key={s.name} className="text-sm">
                    <span style={{ fontWeight: 700, color: "#e0e0e0" }}>{s.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {s.days}日 / {h}h{m}m
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* 勤怠テーブル */}
      {loading ? (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      ) : (
        <div className="rounded-xl border border-border/70 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">日付</TableHead>
                <TableHead className="w-[140px]">スタッフ</TableHead>
                <TableHead className="w-[90px]">出勤</TableHead>
                <TableHead className="w-[90px]">退勤</TableHead>
                <TableHead className="w-[90px]">勤務時間</TableHead>
                <TableHead>メモ / 場所</TableHead>
                <TableHead className="w-[80px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground text-center py-8">
                    データがありません
                  </TableCell>
                </TableRow>
              )}
              {items.map((rec) =>
                editingId === rec.id ? (
                  <EditRow
                    key={rec.id}
                    rec={rec}
                    onSave={(updated) => {
                      setItems((prev) => prev.map((r) => (r.id === rec.id ? updated : r)));
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium tabular-nums">{rec.work_date}</TableCell>
                    <TableCell>
                      <div style={{ fontSize: 13 }}>{rec.user_name ?? rec.user_email ?? "-"}</div>
                      <StatusBadge rec={rec} />
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums font-medium">{fmtTime(rec.clock_in)}</div>
                      {rec.clock_in_address && (
                        <div style={{ fontSize: 10, color: "#666", display: "flex", alignItems: "center", gap: 2 }}>
                          <MapPin size={9} />{rec.clock_in_address.slice(0, 20)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="tabular-nums font-medium">{fmtTime(rec.clock_out)}</div>
                      {rec.clock_out_address && (
                        <div style={{ fontSize: 10, color: "#666", display: "flex", alignItems: "center", gap: 2 }}>
                          <MapPin size={9} />{rec.clock_out_address.slice(0, 20)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {calcWorkHours(rec.clock_in, rec.clock_out)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {rec.note ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(rec.id)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", padding: 4 }}
                          title="編集"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(rec)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}
                          title="削除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
