"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound, Store, User } from "lucide-react";

export default function SettingsPage() {
  const [me, setMe] = React.useState<{
    name: string;
    email: string;
    role: string;
    store_id: string | null;
  } | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setMe(data); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-muted-foreground mt-1">アカウントと店舗の設定を管理します</p>
      </div>

      {/* プロフィール */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            プロフィール
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {me ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">名前</p>
                <p className="font-medium">{me.name || "―"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">メールアドレス</p>
                <p className="font-medium">{me.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ロール</p>
                <p className="font-medium">{me.role}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          )}
        </CardContent>
      </Card>

      {/* セキュリティ */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            セキュリティ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">パスワード</p>
              <p className="text-xs text-muted-foreground">定期的に変更することを推奨します</p>
            </div>
            <Link href="/settings/password">
              <Button variant="outline" size="sm">パスワード変更</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 店舗情報 */}
      {me?.store_id && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" />
              店舗情報
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              店舗ID: <span className="font-mono text-xs">{me.store_id}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
