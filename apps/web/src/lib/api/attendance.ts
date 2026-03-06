import { apiFetch } from "@/lib/api";

// ─── 型定義 ──────────────────────────────────────────────────

export type Attendance = {
  id: string;
  store_id: string;
  user_id: string;
  work_date: string; // YYYY-MM-DD

  clock_in: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_address: string | null;

  clock_out: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_address: string | null;

  note: string | null;
  created_at: string;
  updated_at: string;

  // JOIN 付加フィールド
  user_name: string | null;
  user_email: string | null;
};

export type AttendanceListOut = {
  items: Attendance[];
  total: number;
};

export type ClockRequest = {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  note?: string | null;
};

export type AttendanceUpdate = Partial<{
  work_date: string;
  clock_in: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_address: string | null;
  clock_out: string | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_address: string | null;
  note: string | null;
}>;

// ─── API 関数 ────────────────────────────────────────────────

export type AttendanceFilter = {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
};

export async function listAttendance(params?: AttendanceFilter): Promise<AttendanceListOut> {
  const qs = new URLSearchParams();
  if (params?.start_date) qs.set("start_date", params.start_date);
  if (params?.end_date) qs.set("end_date", params.end_date);
  if (params?.user_id) qs.set("user_id", params.user_id);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return apiFetch<AttendanceListOut>(`/api/v1/attendance${q ? "?" + q : ""}`);
}

export async function getTodayAttendance(): Promise<Attendance | null> {
  const res = await apiFetch<Attendance | null>("/api/v1/attendance/today");
  return res ?? null;
}

export async function clockIn(body: ClockRequest): Promise<Attendance> {
  return apiFetch<Attendance>("/api/v1/attendance/clock-in", { method: "POST", body });
}

export async function clockOut(body: ClockRequest): Promise<Attendance> {
  return apiFetch<Attendance>("/api/v1/attendance/clock-out", { method: "POST", body });
}

export async function updateAttendance(id: string, body: AttendanceUpdate): Promise<Attendance> {
  return apiFetch<Attendance>(`/api/v1/attendance/${id}`, { method: "PUT", body });
}

export async function deleteAttendance(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/attendance/${id}`, { method: "DELETE" });
}

// ─── Nominatim 逆ジオコーディング ────────────────────────────

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`,
      {
        headers: {
          "User-Agent": "VLP-SaaS/1.0 (attendance-feature)",
        },
      }
    );
    if (!res.ok) return "";
    const json = await res.json();
    // display_name は "番地, 町名, 市, 都道府県, 国" の形式
    const addr = json?.address;
    if (!addr) return json?.display_name ?? "";
    // 日本向け: 都道府県+市区町村+町名
    const parts = [
      addr.state,
      addr.city ?? addr.town ?? addr.village ?? addr.county,
      addr.suburb ?? addr.neighbourhood,
      addr.road,
      addr.house_number,
    ].filter(Boolean);
    return parts.join(" ") || json?.display_name || "";
  } catch {
    return "";
  }
}

// ─── GPS 取得 ────────────────────────────────────────────────

export type GpsResult =
  | { ok: true; lat: number; lng: number; address: string }
  | { ok: false; reason: string };

export async function getGpsLocation(): Promise<GpsResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, reason: "この端末はGPSをサポートしていません" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        resolve({ ok: true, lat, lng, address });
      },
      (err) => {
        resolve({ ok: false, reason: err.message });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ─── 勤務時間計算 ────────────────────────────────────────────

export function calcWorkHours(clockIn: string | null, clockOut: string | null): string {
  if (!clockIn || !clockOut) return "-";
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  if (diff < 0) return "-";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}時間${m}分`;
}
