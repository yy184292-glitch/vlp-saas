"use client";

import { useMemo, useState } from "react";

type MemoMap = Record<string, string>; // YYYY-MM-DD -> memo
const MEMO_KEY = "vlp_calendar_memos_v1";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function loadMemos(): MemoMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEMO_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    return obj as MemoMap;
  } catch {
    return {};
  }
}
function saveMemos(m: MemoMap) {
  try {
    window.localStorage.setItem(MEMO_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}
function monthGrid(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const startDay = first.getDay(); // 0..6 (Sun..Sat)
  const start = new Date(year, month0, 1 - startDay);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPanel() {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [memos, setMemos] = useState<MemoMap>(() => loadMemos());
  const [selected, setSelected] = useState<string>(() => ymd(now));
  const [draft, setDraft] = useState<string>(() => memos[ymd(now)] ?? "");

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();

  const days = useMemo(() => monthGrid(year, month0), [year, month0]);

  const onPrev = () => setCursor(new Date(year, month0 - 1, 1));
  const onNext = () => setCursor(new Date(year, month0 + 1, 1));

  const onPick = (date: Date) => {
    const key = ymd(date);
    setSelected(key);
    setDraft(memos[key] ?? "");
  };

  const onSave = () => {
    const next = { ...memos, [selected]: draft };
    if (!draft.trim()) delete next[selected];
    setMemos(next);
    saveMemos(next);
  };

  const monthLabel = `${year}/${pad2(month0 + 1)}`;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 12,
        position: "sticky",
        top: 72, // ClientNavの高さ次第で調整
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button onClick={onPrev}>←</button>
        <div style={{ fontWeight: 900 }}>{monthLabel}</div>
        <button onClick={onNext}>→</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 10 }}>
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} style={{ fontSize: 12, color: "#666", textAlign: "center" }}>
            {w}
          </div>
        ))}

        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month0;
          const isSelected = key === selected;
          const hasMemo = !!memos[key];

          return (
            <button
              key={key}
              onClick={() => onPick(d)}
              style={{
                padding: "10px 0",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: isSelected ? "#f5f5f5" : "#fff",
                opacity: inMonth ? 1 : 0.45,
                fontWeight: hasMemo ? 900 : 600,
                cursor: "pointer",
              }}
              title={hasMemo ? "メモあり" : ""}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>メモ（{selected}）</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          placeholder="メモを入力…"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd", resize: "vertical" }}
        />
        <button
          onClick={onSave}
          style={{ marginTop: 8, width: "100%", padding: 10, borderRadius: 10, fontWeight: 800 }}
        >
          保存
        </button>
      </div>
    </div>
  );
}
