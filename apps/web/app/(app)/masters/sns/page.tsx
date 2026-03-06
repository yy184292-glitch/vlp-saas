"use client";

import * as React from "react";
import {
  Share2, Settings, History, RefreshCw, AlertTriangle, CheckCircle, Clock, RotateCcw
} from "lucide-react";

import {
  getSnsSettings, updateSnsSettings, listSnsPosts, retrySnsPost, getRepostSchedule,
  type SnsSetting, type SnsSettingUpdate, type SnsPost, type RepostScheduleItem,
} from "@/lib/api/sns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// ─── ユーティリティ ──────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function errorMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "エラーが発生しました";
}

const TRIGGER_LABELS: Record<string, string> = {
  new_arrival: "新着",
  price_down: "値下げ",
  sold_out: "SOLD OUT",
  manual: "手動",
  repost: "再投稿",
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  posted: { color: "#10b981" },
  failed: { color: "#ef4444" },
  pending: { color: "#f59e0b" },
  skipped: { color: "#888" },
};

// ─── タブ型 ──────────────────────────────────────────────────

type Tab = "settings" | "history" | "repost";

// ─── SNS設定フォーム ─────────────────────────────────────────

function SettingsForm({ initial, onSaved }: { initial: SnsSetting; onSaved: (s: SnsSetting) => void }) {
  const [form, setForm] = React.useState<SnsSettingUpdate>({
    twitter_enabled: initial.twitter_enabled,
    twitter_api_key: initial.twitter_api_key ?? "",
    twitter_api_secret: initial.twitter_api_secret ?? "",
    twitter_access_token: initial.twitter_access_token ?? "",
    twitter_access_secret: initial.twitter_access_secret ?? "",

    instagram_enabled: initial.instagram_enabled,
    instagram_account_id: initial.instagram_account_id ?? "",
    instagram_access_token: initial.instagram_access_token ?? "",

    line_enabled: initial.line_enabled,
    line_channel_token: initial.line_channel_token ?? "",
    line_channel_secret: initial.line_channel_secret ?? "",

    auto_new_arrival: initial.auto_new_arrival,
    auto_price_down: initial.auto_price_down,
    auto_sold_out: initial.auto_sold_out,

    new_arrival_template: initial.new_arrival_template,
    price_down_template: initial.price_down_template,
    sold_out_template: initial.sold_out_template,

    repost_enabled: initial.repost_enabled,
    repost_interval_weeks: initial.repost_interval_weeks,
    repost_platforms: initial.repost_platforms ?? ["twitter", "line"],
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const upd = (key: keyof SnsSettingUpdate, val: unknown) =>
    setForm((p) => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateSnsSettings(form);
      onSaved(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(errorMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: checked ? "#3b82f6" : "#3a3a3a",
          position: "relative", cursor: "pointer", transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
        }} />
      </div>
      <span style={{ fontSize: 13, color: "#ccc" }}>{label}</span>
    </label>
  );

  const Section = ({ title }: { title: string }) => (
    <div style={{ fontSize: 11, fontWeight: 800, color: "#888", letterSpacing: 1, marginTop: 8 }}>{title}</div>
  );

  const Field = ({ label, value, onChange, type = "text", placeholder = "" }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) => (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Twitter */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <span style={{ color: "#1d9bf0" }}>𝕏 Twitter</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Toggle checked={!!form.twitter_enabled} onChange={(v) => upd("twitter_enabled", v)} label="Twitter 投稿を有効化" />
          {form.twitter_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="API Key" value={form.twitter_api_key ?? ""} onChange={(v) => upd("twitter_api_key", v)} />
              <Field label="API Secret" type="password" value={form.twitter_api_secret ?? ""} onChange={(v) => upd("twitter_api_secret", v)} />
              <Field label="Access Token" value={form.twitter_access_token ?? ""} onChange={(v) => upd("twitter_access_token", v)} />
              <Field label="Access Secret" type="password" value={form.twitter_access_secret ?? ""} onChange={(v) => upd("twitter_access_secret", v)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instagram */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <span style={{ color: "#e1306c" }}>Instagram</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Toggle checked={!!form.instagram_enabled} onChange={(v) => upd("instagram_enabled", v)} label="Instagram 投稿を有効化" />
          {form.instagram_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Account ID" value={form.instagram_account_id ?? ""} onChange={(v) => upd("instagram_account_id", v)} />
              <Field label="Access Token" type="password" value={form.instagram_access_token ?? ""} onChange={(v) => upd("instagram_access_token", v)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* LINE */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <span style={{ color: "#06c755" }}>LINE</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Toggle checked={!!form.line_enabled} onChange={(v) => upd("line_enabled", v)} label="LINE 投稿を有効化" />
          {form.line_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Channel Access Token" type="password" value={form.line_channel_token ?? ""} onChange={(v) => upd("line_channel_token", v)} />
              <Field label="Channel Secret" type="password" value={form.line_channel_secret ?? ""} onChange={(v) => upd("line_channel_secret", v)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 自動投稿トリガー */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">自動投稿トリガー</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Toggle checked={!!form.auto_new_arrival} onChange={(v) => upd("auto_new_arrival", v)} label="新着車両登録時に自動投稿" />
          <Toggle checked={!!form.auto_price_down} onChange={(v) => upd("auto_price_down", v)} label="価格値下げ時に自動投稿" />
          <Toggle checked={!!form.auto_sold_out} onChange={(v) => upd("auto_sold_out", v)} label="SOLD OUT 時に自動投稿" />
        </CardContent>
      </Card>

      {/* 投稿テンプレート */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">投稿テンプレート</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="text-xs text-muted-foreground">
            使用可能変数: {"{car_name}"} {"{year}"} {"{mileage}"} {"{price}"} {"{store_name}"} {"{color}"} {"{comment}"}
          </div>
          {(["new_arrival_template", "price_down_template", "sold_out_template"] as const).map((key) => (
            <div key={key} className="space-y-1">
              <div className="text-xs text-muted-foreground">
                {key === "new_arrival_template" ? "新着テンプレート" : key === "price_down_template" ? "値下げテンプレート" : "SOLD OUT テンプレート"}
              </div>
              <textarea
                value={(form[key] as string) ?? ""}
                onChange={(e) => upd(key, e.target.value)}
                rows={3}
                style={{
                  width: "100%", background: "#1e1e1e", border: "1px solid #3a3a3a",
                  borderRadius: 8, padding: "8px 12px", color: "#e0e0e0", fontSize: 13,
                  resize: "vertical", outline: "none",
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 定期再投稿 */}
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw size={14} /> 定期再投稿
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Toggle checked={!!form.repost_enabled} onChange={(v) => upd("repost_enabled", v)} label="定期再投稿を有効化" />
          {form.repost_enabled && (
            <>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  再投稿間隔: {form.repost_interval_weeks} 週
                </div>
                <input
                  type="range"
                  min={1} max={12}
                  value={form.repost_interval_weeks ?? 2}
                  onChange={(e) => upd("repost_interval_weeks", Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#3b82f6" }}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1週</span><span>6週</span><span>12週</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">再投稿プラットフォーム</div>
                <div style={{ display: "flex", gap: 12 }}>
                  {["twitter", "instagram", "line"].map((p) => {
                    const platforms = form.repost_platforms ?? [];
                    const checked = platforms.includes(p);
                    return (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? platforms.filter((x) => x !== p)
                              : [...platforms, p];
                            upd("repost_platforms", next);
                          }}
                        />
                        {p}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {saved && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "#10b981" }}>
          <CheckCircle size={14} /> 保存しました
        </div>
      )}
      <Button onClick={save} disabled={saving}>
        {saving ? "保存中..." : "設定を保存"}
      </Button>
    </div>
  );
}

// ─── 投稿履歴 ────────────────────────────────────────────────

function PostHistory() {
  const [posts, setPosts] = React.useState<SnsPost[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSnsPosts({ limit: 50, status: statusFilter || undefined });
      setPosts(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(errorMsg(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => { void load(); }, [load]);

  const retry = async (post: SnsPost) => {
    try {
      await retrySnsPost(post.id);
      await load();
    } catch (e) {
      setError(errorMsg(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 8, padding: "6px 10px", color: "#e0e0e0", fontSize: 13 }}
        >
          <option value="">すべて</option>
          <option value="posted">投稿済み</option>
          <option value="failed">失敗</option>
          <option value="skipped">スキップ</option>
          <option value="pending">保留中</option>
        </select>
        <Button variant="secondary" size="sm" onClick={load}>再読込</Button>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading && <div className="text-sm text-muted-foreground">読み込み中...</div>}

      <div className="space-y-2">
        {posts.map((post) => (
          <div
            key={post.id}
            style={{
              background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 10,
              padding: "12px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#3a3a3a", padding: "2px 8px", borderRadius: 6, color: "#ccc" }}>
                    {TRIGGER_LABELS[post.trigger] ?? post.trigger}
                  </span>
                  <span style={{ fontSize: 12, color: "#888" }}>{post.platform}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, ...STATUS_STYLE[post.status] }}>
                    {post.status === "posted" ? "✓ 投稿済み" : post.status === "failed" ? "✗ 失敗" : post.status === "skipped" ? "− スキップ" : "○ 保留"}
                  </span>
                  {post.repost_count > 0 && (
                    <span style={{ fontSize: 11, color: "#888" }}>再投稿{post.repost_count}回目</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {post.caption.slice(0, 120)}{post.caption.length > 120 ? "…" : ""}
                </div>
                {post.error_message && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{post.error_message}</div>
                )}
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  {fmtDate(post.posted_at ?? post.created_at)}
                </div>
              </div>
              {(post.status === "failed" || post.status === "skipped") && (
                <button
                  type="button"
                  onClick={() => retry(post)}
                  style={{
                    background: "transparent", border: "1px solid #3a3a3a", borderRadius: 6,
                    padding: "4px 8px", cursor: "pointer", color: "#aaa", fontSize: 12,
                    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                  }}
                  title="リトライ"
                >
                  <RotateCcw size={12} /> リトライ
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && posts.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8">投稿履歴がありません</div>
        )}
      </div>
    </div>
  );
}

// ─── 定期再投稿管理 ──────────────────────────────────────────

function RepostSchedule({ setting }: { setting: SnsSetting | null }) {
  const [items, setItems] = React.useState<RepostScheduleItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!setting?.repost_enabled) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const data = await getRepostSchedule();
        setItems(data);
      } catch (e) {
        setError(errorMsg(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [setting?.repost_enabled]);

  if (!setting?.repost_enabled) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        定期再投稿が無効です。「設定」タブで有効化してください。
      </div>
    );
  }

  if (loading) return <div className="text-sm text-muted-foreground">読み込み中...</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        再投稿が必要な車両はありません。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        再投稿間隔: {setting.repost_interval_weeks} 週 ／ 対象 {items.length} 台
      </div>
      {items.map((item) => (
        <div
          key={item.car_id}
          style={{
            background: "#2a2a2a",
            border: `1px solid ${item.overdue ? "#ef444460" : "#3a3a3a"}`,
            borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0e0" }}>{item.car_name}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              最終投稿: {fmtDate(item.last_posted_at)}
            </div>
            <div style={{ fontSize: 12, color: item.overdue ? "#ef4444" : "#aaa", marginTop: 1 }}>
              次回予定: {fmtDate(item.next_repost_at)}
            </div>
          </div>
          {item.overdue && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} /> 期限超過
            </span>
          )}
          {!item.overdue && (
            <span style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} /> 予定あり
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── メインページ ────────────────────────────────────────────

export default function SnsPage() {
  const [tab, setTab] = React.useState<Tab>("settings");
  const [setting, setSetting] = React.useState<SnsSetting | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const s = await getSnsSettings();
        setSetting(s);
      } catch (e) {
        setLoadError(errorMsg(e));
      }
    })();
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: "設定", icon: <Settings size={14} /> },
    { id: "history", label: "投稿履歴", icon: <History size={14} /> },
    { id: "repost", label: "定期再投稿", icon: <RefreshCw size={14} /> },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Share2 className="h-5 w-5" />
        SNS自動投稿
      </div>
      <div className="text-sm text-muted-foreground">
        Twitter・Instagram・LINE への自動投稿設定・履歴確認・定期再投稿管理
      </div>

      {loadError && (
        <div className="text-sm text-destructive">{loadError}</div>
      )}

      {/* タブ */}
      <div style={{ display: "flex", gap: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px", borderRadius: 10, border: "none",
              background: tab === t.id ? "#3b82f6" : "#2a2a2a",
              color: tab === t.id ? "#fff" : "#aaa",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <Separator />

      {tab === "settings" && setting && (
        <SettingsForm initial={setting} onSaved={(s) => setSetting(s)} />
      )}
      {tab === "settings" && !setting && !loadError && (
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      )}
      {tab === "history" && <PostHistory />}
      {tab === "repost" && <RepostSchedule setting={setting} />}
    </div>
  );
}
