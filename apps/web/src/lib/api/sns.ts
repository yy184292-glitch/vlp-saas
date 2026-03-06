import { apiFetch } from "@/lib/api";

// ─── 型定義 ──────────────────────────────────────────────────

export type SnsSetting = {
  id: string;
  store_id: string;

  twitter_enabled: boolean;
  twitter_api_key: string | null;
  twitter_api_secret: string | null;
  twitter_access_token: string | null;
  twitter_access_secret: string | null;

  instagram_enabled: boolean;
  instagram_account_id: string | null;
  instagram_access_token: string | null;

  line_enabled: boolean;
  line_channel_token: string | null;
  line_channel_secret: string | null;

  auto_new_arrival: boolean;
  auto_price_down: boolean;
  auto_sold_out: boolean;

  new_arrival_template: string;
  price_down_template: string;
  sold_out_template: string;

  repost_enabled: boolean;
  repost_interval_weeks: number;
  repost_platforms: string[] | null;

  created_at: string;
  updated_at: string;
};

export type SnsSettingUpdate = Partial<Omit<SnsSetting, "id" | "store_id" | "created_at" | "updated_at">>;

export type SnsPost = {
  id: string;
  store_id: string;
  car_id: string | null;
  trigger: string;
  platform: string;
  status: "pending" | "posted" | "failed" | "skipped";
  caption: string;
  image_urls: string[] | null;
  posted_at: string | null;
  error_message: string | null;
  repost_count: number;
  created_at: string;
};

export type SnsPostListOut = {
  items: SnsPost[];
  total: number;
};

export type SnsPostCreate = {
  car_id?: string | null;
  trigger?: string;
  platform?: string;
  caption: string;
  image_urls?: string[] | null;
};

export type SnsPreview = {
  trigger: string;
  caption: string;
};

export type RepostScheduleItem = {
  car_id: string;
  car_name: string;
  last_posted_at: string;
  next_repost_at: string;
  overdue: boolean;
};

// ─── API 関数 ────────────────────────────────────────────────

export async function getSnsSettings(): Promise<SnsSetting> {
  return apiFetch<SnsSetting>("/api/v1/sns/settings");
}

export async function updateSnsSettings(body: SnsSettingUpdate): Promise<SnsSetting> {
  return apiFetch<SnsSetting>("/api/v1/sns/settings", { method: "PUT", body });
}

export type SnsPostFilter = {
  trigger?: string;
  platform?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function listSnsPosts(params?: SnsPostFilter): Promise<SnsPostListOut> {
  const qs = new URLSearchParams();
  if (params?.trigger) qs.set("trigger", params.trigger);
  if (params?.platform) qs.set("platform", params.platform);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return apiFetch<SnsPostListOut>(`/api/v1/sns/posts${q ? "?" + q : ""}`);
}

export async function createSnsPost(body: SnsPostCreate): Promise<SnsPost> {
  return apiFetch<SnsPost>("/api/v1/sns/posts", { method: "POST", body });
}

export async function retrySnsPost(postId: string): Promise<SnsPost> {
  return apiFetch<SnsPost>(`/api/v1/sns/posts/${postId}/retry`, { method: "POST" });
}

export async function previewSnsPost(carId: string): Promise<SnsPreview[]> {
  return apiFetch<SnsPreview[]>(`/api/v1/sns/preview?car_id=${carId}`);
}

export async function getRepostSchedule(): Promise<RepostScheduleItem[]> {
  return apiFetch<RepostScheduleItem[]>("/api/v1/sns/repost-schedule");
}

export async function triggerSnsPost(body: SnsPostCreate & { trigger: string }): Promise<SnsPost> {
  return apiFetch<SnsPost>("/api/v1/sns/trigger", { method: "POST", body });
}
