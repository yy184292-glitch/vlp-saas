import { apiFetch } from "./core";

// ---- 型定義 ----

export interface LineSetting {
  id: string;
  store_id: string;
  channel_access_token: string | null;
  channel_secret: string | null;
  liff_id: string | null;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  welcome_message: string | null;
}

export interface LineCustomer {
  id: string;
  store_id: string;
  customer_id: string | null;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  follow_status: "following" | "blocked" | "unknown";
  followed_at: string | null;
  blocked_at: string | null;
}

export interface LineMessage {
  id: string;
  line_customer_id: string;
  direction: "inbound" | "outbound";
  message_type: "text" | "image" | "sticker" | "other";
  content: string | null;
  line_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface LineTestResult {
  status: "ok" | "error";
  bot_name?: string;
  picture_url?: string;
  detail?: string;
}

// ---- 設定 ----

export async function getLineSettings(): Promise<LineSetting> {
  return apiFetch<LineSetting>("/api/v1/line/settings");
}

export async function updateLineSettings(input: Partial<LineSetting>): Promise<LineSetting> {
  return apiFetch<LineSetting>("/api/v1/line/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function testLineConnection(): Promise<LineTestResult> {
  return apiFetch<LineTestResult>("/api/v1/line/settings/test", { method: "POST" });
}

// ---- 顧客 ----

export async function listLineCustomers(): Promise<LineCustomer[]> {
  return apiFetch<LineCustomer[]>("/api/v1/line/customers");
}

export async function getLineCustomer(id: string): Promise<LineCustomer> {
  return apiFetch<LineCustomer>(`/api/v1/line/customers/${id}`);
}

export async function linkLineCustomer(id: string, customerId: string | null): Promise<LineCustomer> {
  return apiFetch<LineCustomer>(`/api/v1/line/customers/${id}/link`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_id: customerId }),
  });
}

// ---- メッセージ ----

export async function listLineMessages(lineCustomerId?: string): Promise<LineMessage[]> {
  const q = lineCustomerId ? `?line_customer_id=${lineCustomerId}` : "";
  return apiFetch<LineMessage[]>(`/api/v1/line/messages${q}`);
}

export async function sendLineMessage(input: { line_customer_id: string; message: string }): Promise<void> {
  await apiFetch("/api/v1/line/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function broadcastLineMessage(message: string): Promise<void> {
  await apiFetch("/api/v1/line/messages/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

// ---- 通知 ----

export async function notifyWorkOrder(input: {
  line_customer_id: string;
  car_name: string;
  work_summary: string;
  total_price: number;
  detail_url?: string;
}): Promise<void> {
  await apiFetch("/api/v1/line/notify/work-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function notifyEstimate(input: {
  line_customer_id: string;
  car_name: string;
  estimate_price: number;
  estimate_url?: string;
}): Promise<void> {
  await apiFetch("/api/v1/line/notify/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
