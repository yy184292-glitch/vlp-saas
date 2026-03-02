"use client";

import { useEffect, useMemo, useState } from "react";

type MemoMap = Record<string, string>; // YYYY-MM-DD -> memo
const MEMO_KEY = "vlp_calendar_memos_v1";
const HOLIDAYS_KEY = "vlp_calendar_holidays_jp_v1";

type CalendarEvent = {
  id: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (inclusive)
  due_at: string; // ISO
  status: string;
  title: string;
  memo?: string | null;
};

type DayItem = {
  id: string;
  received_at: string;
  due_at: string;
  status: string;
  memo?: string | null;
  car_stock_no?: string | null;
  car_title?: string | null;
};

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

function apiBaseUrl() {
  // 既存コードの env に合わせて両対応
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  return base.replace(/\/+$/, "");
}

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseISODateOnly(iso: string): string {
  // ISO -> YYYY-MM-DD
  if (!iso) return "";
  return iso.slice(0, 10);
}

function diffDays(fromYmd: string, toISO: string): number {
  // fromYmd(YYYY-MM-DD) をローカル日付として、toISO をローカルに変換して差分日数
  const [y, m, d] = fromYmd.split("-").map((x) => Number(x));
  const from = new Date(y, m - 1, d, 0, 0, 0);
  const to = new Date(toISO);
  // 当日を 0 日として扱う
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function dueColorByDiff(diff: number): string {
  // memo仕様：期限超過:赤 / 0-2:オレンジ / 3-7:黄色 / 8+:緑
  if (diff < 0) return "#ef4444"; // red-500
  if (diff <= 2) return "#fb923c"; // orange-400
  if (diff <= 7) return "#facc15"; // yellow-400
  return "#4ade80"; // green-400
}

function loadHolidays(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HOLIDAYS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    return obj as Record<string, string>;
  } catch {
    return {};
  }
}

function saveHolidays(h: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(h));
  } catch {
    // ignore
  }
}

export default function CalendarPanel() {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [memos, setMemos] = useState<MemoMap>(() => loadMemos());
  const [selected, setSelected] = useState<string>(() => ymd(now));
  const [draft, setDraft] = useState<string>(() => memos[ymd(now)] ?? "");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dayItems, setDayItems] = useState<DayItem[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>(() => loadHolidays());
  const [apiError, setApiError] = useState<string>("");

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();

  const days = useMemo(() => monthGrid(year, month0), [year, month0]);

  // month range fetch
  useEffect(() => {
    let aborted = false;
    async function load() {
      setApiError("");

      const base = apiBaseUrl();
      if (!base) {
        setEvents([]);
        return;
      }

      const from = ymd(days[0]);
      const to = ymd(days[days.length - 1]);

      try {
        const url = `${base}/api/v1/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
        }
        const data = (await res.json()) as unknown;
        if (!Array.isArray(data)) throw new Error("Invalid calendar/events response");
        if (!aborted) setEvents(data as CalendarEvent[]);
      } catch (e) {
        if (!aborted) {
          setApiError(e instanceof Error ? e.message : "Calendar API error");
          setEvents([]);
        }
      }
    }
    void load();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month0]);

  // selected day fetch
  useEffect(() => {
    let aborted = false;
    async function loadDay() {
      const base = apiBaseUrl();
      if (!base) {
        setDayItems([]);
        return;
      }
      try {
        const url = `${base}/api/v1/calendar/day?date=${encodeURIComponent(selected)}`;
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
        }
        const data = (await res.json()) as any;
        const items = Array.isArray(data?.items) ? (data.items as DayItem[]) : [];
        if (!aborted) setDayItems(items);
      } catch {
        if (!aborted) setDayItems([]);
      }
    }
    void loadDay();
    return () => {
      aborted = true;
    };
  }, [selected]);

  // holidays (JP) best-effort
  useEffect(() => {
    let aborted = false;
    async function load() {
      // 既にある程度入っていればスキップ
      if (Object.keys(holidays).length > 50) return;
      try {
        const res = await fetch("https://holidays-jp.github.io/api/v1/date.json", { cache: "force-cache" });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, string>;
        if (!aborted && data && typeof data === "object") {
          setHolidays(data);
          saveHolidays(data);
        }
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // map: day -> most urgent due color
  const urgencyDotByDay = useMemo(() => {
    const m: Record<string, string> = {};
    for (const ev of events) {
      const end = ev.end;
      // end(期限日) 기준으로色
      const diff = diffDays(ymd(new Date()), ev.due_at);
      const c = dueColorByDiff(diff);

      // 期間中の各日に「最も危険な色」を置きたいので diff の最小を採用
      // 簡易：赤 > オレンジ > 黄 > 緑 の優先
      const rank = (color: string) => {
        if (color === "#ef4444") return 0;
        if (color === "#fb923c") return 1;
        if (color === "#facc15") return 2;
        return 3;
      };

      const start = ev.start;
      // inclusive range
      const cur = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      while (cur.getTime() <= endDate.getTime()) {
        const k = ymd(cur);
        if (!m[k] || rank(c) < rank(m[k])) m[k] = c;
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [events]);

  const selectedDue = dayItems.filter((it) => parseISODateOnly(it.due_at) === selected);
  const selectedReceived = dayItems.filter((it) => parseISODateOnly(it.received_at) === selected);
  const selectedInProgress = dayItems.filter((it) => {
    const r = parseISODateOnly(it.received_at);
    const du = parseISODateOnly(it.due_at);
    return r < selected && selected < du;
  });

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
          const isToday = key === ymd(now);

          const holidayName = holidays[key];
          const dayOfWeek = d.getDay();
          const isSunOrHoliday = dayOfWeek === 0 || !!holidayName;
          const isSat = dayOfWeek === 6;

          const dotColor = urgencyDotByDay[key];

          const textColor = isSunOrHoliday ? "#ef4444" : isSat ? "#3b82f6" : "#111";

          return (
            <button
              key={key}
              onClick={() => onPick(d)}
              style={{
                padding: "10px 0",
                borderRadius: 10,
                border: isToday ? "2px solid #111" : "1px solid #ddd",
                background: isSelected ? "#f5f5f5" : "#fff",
                opacity: inMonth ? 1 : 0.45,
                fontWeight: hasMemo ? 900 : 600,
                cursor: "pointer",
                color: textColor,
                position: "relative",
              }}
              title={holidayName ? `祝日: ${holidayName}` : hasMemo ? "メモあり" : ""}
            >
              {d.getDate()}
              {dotColor ? (
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 6,
                    transform: "translateX(-50%)",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: dotColor,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {apiError ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "#b91c1c" }}>
          カレンダー連携エラー: {apiError}
        </div>
      ) : null}

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

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>指示書（{selected}）</div>

        <div style={{ display: "grid", gap: 8 }}>
          <Section title="期限指示書" items={selectedDue} />
          <Section title="入庫指示書" items={selectedReceived} />
          <Section title="進行中指示書" items={selectedInProgress} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: DayItem[] }) {
  if (!items.length) return null;
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{title}（{items.length}）</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((it) => {
          const dueYmd = parseISODateOnly(it.due_at);
          const today = ymd(new Date());
          const diff = diffDays(today, it.due_at);
          const color = dueColorByDiff(diff);
          const label = `${it.car_stock_no ?? ""} ${it.car_title ?? ""}`.trim() || "指示書";
          return (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flex: "0 0 auto" }} />
              <div style={{ fontSize: 12, lineHeight: 1.3 }}>
                <div style={{ fontWeight: 800 }}>{label}</div>
                <div style={{ color: "#666" }}>期限: {dueYmd} / status: {it.status}</div>
                {it.memo ? <div style={{ color: "#111" }}>{it.memo}</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
