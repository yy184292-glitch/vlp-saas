"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createLicense, type LicensePlan, type LicenseCreateResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Copy } from "lucide-react";

const PLAN_OPTIONS: { value: LicensePlan; label: string; description: string }[] = [
  { value: "starter", label: "スタート", description: "ユーザー5名まで・基本機能" },
  { value: "standard", label: "スタンダード", description: "ユーザー10名まで・全機能" },
  { value: "pro", label: "プロ", description: "ユーザー無制限・優先サポート" },
];

// ─── Success Screen ──────────────────────────────────────────────────────────

function SuccessScreen({
  result,
  onNew,
}: {
  result: LicenseCreateResult;
  onNew: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
        <div>
          <p className="font-bold text-emerald-800">ライセンス発行完了</p>
          <p className="text-sm text-emerald-700">{result.message}</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">発行情報</CardTitle>
          <CardDescription>
            初期パスワードは一度だけ表示されます。必ず安全な方法でお知らせください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3 font-mono text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-sans text-xs">店舗名</span>
              <span className="font-semibold">{result.license.store_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-sans text-xs">プラン</span>
              <span className="font-semibold">{result.license.plan}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 font-sans text-xs">管理者メール</span>
              <span>{result.admin_email}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-sans text-xs font-semibold">初期パスワード</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-wider text-black">
                    {result.initial_password}
                  </span>
                  <button
                    onClick={() => copy(result.initial_password)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? "コピー済み" : "コピー"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onNew}>
          続けて発行
        </Button>
        <Button
          className="flex-1"
          onClick={() => (window.location.href = "/admin/licenses")}
        >
          一覧に戻る
        </Button>
      </div>
    </div>
  );
}

// ─── Form ────────────────────────────────────────────────────────────────────

export default function NewLicensePage() {
  const router = useRouter();

  const [storeName, setStoreName] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [plan, setPlan] = React.useState<LicensePlan>("starter");
  const [trialDays, setTrialDays] = React.useState(30);
  const [notes, setNotes] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LicenseCreateResult | null>(null);

  function reset() {
    setStoreName("");
    setAdminEmail("");
    setAdminName("");
    setPlan("starter");
    setTrialDays(30);
    setNotes("");
    setError(null);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await createLicense({
        store_name: storeName.trim(),
        admin_email: adminEmail.trim(),
        admin_name: adminName.trim() || "管理者",
        plan,
        trial_days: trialDays,
        notes: notes.trim() || undefined,
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? "発行に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return <SuccessScreen result={result} onNew={reset} />;
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">ライセンス発行</h1>
        <p className="text-sm text-muted-foreground mt-1">
          新規店舗のアカウントとライセンスを同時に作成します
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">店舗情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                店舗名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="例: ○○モータース"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                管理者メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">管理者名</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="例: 山田 太郎"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">プラン・期間</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">プラン選択</label>
              <div className="grid gap-2">
                {PLAN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPlan(opt.value)}
                    className={[
                      "flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
                      plan === opt.value
                        ? "border-black bg-black/5"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-0.5 h-4 w-4 rounded-full border-2 shrink-0",
                        plan === opt.value ? "border-black bg-black" : "border-slate-300",
                      ].join(" ")}
                    />
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                試用期間（日数）
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                className="h-10 w-32 rounded-md border bg-background px-3 text-sm shadow-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">メモ（任意）</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="紹介経路・特記事項など"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/admin/licenses")}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={saving} className="flex-1 font-bold">
            {saving ? "発行中…" : "ライセンス発行"}
          </Button>
        </div>
      </form>
    </div>
  );
}
