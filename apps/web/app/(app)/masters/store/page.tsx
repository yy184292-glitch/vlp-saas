"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Me = {
  id: string;
  store_id: string;
};

type Store = {
  id: string;
  name: string;

  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
  email?: string | null;

  invoice_number?: string | null;

  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;

  plan_code: string;
  seat_limit: number;

  created_at: string;
  updated_at: string;
};

type StoreUpdatePayload = {
  name?: string | null;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
  email?: string | null;

  invoice_number?: string | null;

  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account_type?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
};

export default function StoreInfoPage() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [store, setStore] = React.useState<Store | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<Me>("/api/v1/users/me");
      const s = await apiFetch<Store>(`/api/v1/stores/${me.store_id}`);
      setStore(s);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = React.useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);

    const payload: StoreUpdatePayload = {
      name: store.name ?? null,
      postal_code: store.postal_code ?? null,
      address1: store.address1 ?? null,
      address2: store.address2 ?? null,
      tel: store.tel ?? null,
      email: store.email ?? null,
      invoice_number: store.invoice_number ?? null,

      bank_name: store.bank_name ?? null,
      bank_branch: store.bank_branch ?? null,
      bank_account_type: store.bank_account_type ?? null,
      bank_account_number: store.bank_account_number ?? null,
      bank_account_holder: store.bank_account_holder ?? null,
    };

    try {
      const s = await apiFetch<Store>(`/api/v1/stores/${store.id}`, {
        method: "PUT",
        body: payload, // ★ apiFetch が JSON 化するので string にしない
      });
      setStore(s);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [store]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">店舗情報</div>
          <div className="text-sm text-muted-foreground">請求書・見積の表記に使う店舗情報です。</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline" className="bg-white/70 hover:bg-white border-border/70 shadow-sm">
            <Link href="/masters">各種マスタへ戻る</Link>
          </Button>
          <Button onClick={save} disabled={loading || !store}>
            保存
          </Button>
        </div>
      </div>

      <Separator />

      <Card className="rounded-2xl border-2 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
          <CardDescription>店舗名や住所など。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {error ? <div className="sm:col-span-2 text-sm text-destructive">{error}</div> : null}

          <div className="grid gap-2 sm:col-span-2">
            <Label>店舗名</Label>
            <Input
              value={store?.name ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, name: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label>電話</Label>
            <Input
              value={store?.tel ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, tel: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label>メール</Label>
            <Input
              value={store?.email ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, email: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label>郵便番号</Label>
            <Input
              value={store?.postal_code ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, postal_code: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>住所</Label>
            <Input
              value={store?.address1 ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, address1: e.target.value } : p))}
              className="bg-white"
              placeholder="住所1"
              disabled={loading}
            />
            <Input
              value={store?.address2 ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, address2: e.target.value } : p))}
              className="bg-white"
              placeholder="住所2"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label>適格請求書発行事業者番号</Label>
            <Input
              value={store?.invoice_number ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, invoice_number: e.target.value } : p))}
              className="bg-white"
              placeholder="T1234567890123"
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-2 bg-white/80 shadow-sm">
        <CardHeader>
          <CardTitle>振込先</CardTitle>
          <CardDescription>請求書に表示する場合に設定。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>銀行名</Label>
            <Input
              value={store?.bank_name ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, bank_name: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label>支店名</Label>
            <Input
              value={store?.bank_branch ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, bank_branch: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label>口座種別</Label>
            <Input
              value={store?.bank_account_type ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, bank_account_type: e.target.value } : p))}
              className="bg-white"
              placeholder="普通/当座など"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label>口座番号</Label>
            <Input
              value={store?.bank_account_number ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, bank_account_number: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>口座名義</Label>
            <Input
              value={store?.bank_account_holder ?? ""}
              onChange={(e) => setStore((p) => (p ? { ...p, bank_account_holder: e.target.value } : p))}
              className="bg-white"
              disabled={loading}
            />
          </div>

          <div className="sm:col-span-2 rounded-xl border bg-white p-4">
            <div className="text-sm text-muted-foreground">
              プラン: <span className="font-medium text-foreground">{store?.plan_code ?? ""}</span> / 席数上限:{" "}
              <span className="font-medium text-foreground">{store?.seat_limit ?? ""}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
