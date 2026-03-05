"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, KeyRound, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function PasswordChangePage() {
  const [currentPw, setCurrentPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function validate(): string | null {
    if (!currentPw) return "現在のパスワードを入力してください";
    if (!newPw) return "新しいパスワードを入力してください";
    if (newPw.length < 8) return "新しいパスワードは8文字以上で入力してください";
    if (newPw !== confirmPw) return "新しいパスワードと確認用パスワードが一致しません";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      setSuccess(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e: any) {
      setError(e?.message ?? "パスワードの変更に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">パスワード変更</h1>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            新しいパスワードを設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              パスワードを変更しました
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">現在のパスワード</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
                placeholder="現在のパスワード"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">新しいパスワード</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
                placeholder="8文字以上"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">新しいパスワード（確認）</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
                placeholder="もう一度入力"
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "変更中…" : "変更する"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
