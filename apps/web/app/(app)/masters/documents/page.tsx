"use client";

import * as React from "react";
import Link from "next/link";

import type { ApiError } from "@/lib/api";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

type StoreSettings = {
  store_id: string;
  default_staff_id?: string | null;
  print_fields?: any | null;
};

type Staff = {
  id: string;
  store_id: string;
  name: string;
  name_kana?: string | null;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
};

function getApiBaseUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_ORIGIN ??
    "";
  return base.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

const DEFAULT_PRINT_FIELDS = {
  ininjou: {
    recipient_block: true,
    purpose_transfer: true,
    car_number: true,
    delegator_block: true,
  },
  jouto: {
    car_info: true,
    owners_block: true,
    transfer_date: true,
    old_owner_seal: true,
  },
};

export default function Page() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [settings, setSettings] = React.useState<StoreSettings | null>(null);
  const [staff, setStaff] = React.useState<Staff[]>([]);

  const [newStaffName, setNewStaffName] = React.useState("");
  const [newStaffAddress1, setNewStaffAddress1] = React.useState("");
  const [newStaffTel, setNewStaffTel] = React.useState("");

  const printFields = React.useMemo(() => {
    const cur = settings?.print_fields ?? null;
    if (!cur) return DEFAULT_PRINT_FIELDS;
    // shallow merge
    return {
      ...DEFAULT_PRINT_FIELDS,
      ...cur,
      ininjou: { ...DEFAULT_PRINT_FIELDS.ininjou, ...(cur.ininjou ?? {}) },
      jouto: { ...DEFAULT_PRINT_FIELDS.jouto, ...(cur.jouto ?? {}) },
    };
  }, [settings]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const s = await apiFetch<StoreSettings>(buildUrl("/api/v1/settings/store"), { method: "GET" });
      const st = await apiFetch<Staff[]>(buildUrl("/api/v1/masters/staff"), { method: "GET" });
      setSettings(s);
      setStaff(st);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadAll();
  }, []);

  async function saveSettings(patch: Partial<StoreSettings>) {
    if (!settings) return;
    setError(null);
    try {
      const next = await apiFetch<StoreSettings>(buildUrl("/api/v1/settings/store"), {
        method: "PUT",
        body: JSON.stringify({ ...patch, store_id: settings.store_id }),
      });
      setSettings(next);
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "保存に失敗しました");
    }
  }

  async function addStaff() {
    setError(null);
    try {
      if (!newStaffName.trim()) {
        setError("スタッフ名を入力してください");
        return;
      }
      await apiFetch<Staff>(buildUrl("/api/v1/masters/staff"), {
        method: "POST",
        body: JSON.stringify({
          name: newStaffName.trim(),
          address1: newStaffAddress1.trim() || null,
          tel: newStaffTel.trim() || null,
        }),
      });
      setNewStaffName("");
      setNewStaffAddress1("");
      setNewStaffTel("");
      await loadAll();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "追加に失敗しました");
    }
  }

  async function deleteStaff(id: string) {
    setError(null);
    try {
      await apiFetch(buildUrl(`/api/v1/masters/staff/${id}`), { method: "DELETE" });
      await loadAll();
    } catch (e) {
      const ae = e as ApiError;
      setError(ae.message ?? "削除に失敗しました");
    }
  }

  function toggle(path: ["ininjou" | "jouto", string], value: boolean) {
    if (!settings) return;
    const next = {
      ...printFields,
      [path[0]]: { ...(printFields as any)[path[0]], [path[1]]: value },
    };
    void saveSettings({ print_fields: next } as any);
  }

  if (loading) {
    return (
      <main className="p-4">
        <div>読み込み中...</div>
      </main>
    );
  }

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">書類印刷設定</h1>
        <Link href="/masters">
          <Button variant="outline" size="sm">戻る</Button>
        </Link>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>店舗スタッフ（受任者マスタ）</CardTitle>
          <CardDescription>委任状の受任者（店舗の人）を登録し、デフォルトを選べます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>氏名</Label>
              <Input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="例：山田 太郎" />
            </div>
            <div className="space-y-1">
              <Label>住所（1行目）</Label>
              <Input value={newStaffAddress1} onChange={(e) => setNewStaffAddress1(e.target.value)} placeholder="例：北海道札幌市..." />
            </div>
            <div className="space-y-1">
              <Label>TEL</Label>
              <Input value={newStaffTel} onChange={(e) => setNewStaffTel(e.target.value)} placeholder="例：011-xxxx-xxxx" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => void addStaff()}>追加</Button>
            <Button variant="outline" onClick={() => void loadAll()}>再読み込み</Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>デフォルト受任者</Label>
            <Select
              value={settings?.default_staff_id ?? ""}
              onValueChange={(v) => void saveSettings({ default_staff_id: v || null } as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">未選択</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-3 space-y-2">
              {staff.length === 0 ? <div className="text-sm text-muted-foreground">まだ登録がありません</div> : null}
              {staff.map((s) => (
                <div key={s.id} className="flex items-center gap-2 border rounded-md p-2">
                  <div className="flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(s.address1 ?? "") + (s.tel ? ` / ${s.tel}` : "")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void deleteStaff(s.id)}>
                    削除
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>印刷項目 ON / OFF</CardTitle>
          <CardDescription>次のチャットで入力サンプルをもらったら、ここのON/OFFに従って印字します。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="font-semibold">委任状</div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>①② 受任者ブロック（住所・氏名）</div>
              <Switch checked={!!printFields.ininjou.recipient_block} onCheckedChange={(v) => toggle(["ininjou","recipient_block"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>③ 目的（移転登録）</div>
              <Switch checked={!!printFields.ininjou.purpose_transfer} onCheckedChange={(v) => toggle(["ininjou","purpose_transfer"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>車両情報（登録番号）</div>
              <Switch checked={!!printFields.ininjou.car_number} onCheckedChange={(v) => toggle(["ininjou","car_number"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>④ 委任者（署名欄）</div>
              <Switch checked={!!printFields.ininjou.delegator_block} onCheckedChange={(v) => toggle(["ininjou","delegator_block"], v)} />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="font-semibold">譲渡証明書</div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>① 車両情報（車名/型式/車台番号/原動機型式）</div>
              <Switch checked={!!printFields.jouto.car_info} onCheckedChange={(v) => toggle(["jouto","car_info"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>② 旧/新 所有者（氏名・住所）</div>
              <Switch checked={!!printFields.jouto.owners_block} onCheckedChange={(v) => toggle(["jouto","owners_block"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>③ 譲渡日</div>
              <Switch checked={!!printFields.jouto.transfer_date} onCheckedChange={(v) => toggle(["jouto","transfer_date"], v)} />
            </div>
            <div className="flex items-center justify-between border rounded-md p-2">
              <div>④ 旧所有者 実印欄（枠だけ）</div>
              <Switch checked={!!printFields.jouto.old_owner_seal} onCheckedChange={(v) => toggle(["jouto","old_owner_seal"], v)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
