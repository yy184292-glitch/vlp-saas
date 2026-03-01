"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


// ========= Types =========
type WorkMaster = {
  id: string;
  name: string; // 表示名
  category: string; // 例: 整備/点検/消耗品
  unit: string; // 例: 回 / L / 個
  defaultQty: number; // 初期数量
  sellPrice: number; // 売価（税抜想定）
  costPrice: number; // 原価（仕入）
  taxable: boolean; // 課税
  active: boolean; // 有効/無効
  updatedAt: string; // ISO
  createdAt: string; // ISO
};

const STORAGE_KEY = "vlp_work_masters_v1";

// ========= Utils =========
function nowIso() {
  return new Date().toISOString();
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `wm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadAll(): WorkMaster[] {
  if (typeof window === "undefined") return [];
  const arr = safeParseJson<unknown[]>(window.localStorage.getItem(STORAGE_KEY), []);
  if (!Array.isArray(arr)) return [];

  const normalize = (x: any): WorkMaster | null => {
    if (!x || typeof x !== "object") return null;
    const name = String(x.name ?? "").trim();
    if (!name) return null;

    const unit = String(x.unit ?? "回").trim() || "回";
    const category = String(x.category ?? "").trim();
    const createdAt = String(x.createdAt ?? x.created_at ?? nowIso());
    const updatedAt = String(x.updatedAt ?? x.updated_at ?? createdAt);

    const sellPrice = Number(x.sellPrice ?? 0);
    const costPrice = Number(x.costPrice ?? 0);
    const defaultQty = Number(x.defaultQty ?? 1);

    return {
      id: String(x.id ?? uid()),
      name,
      category,
      unit,
      defaultQty: Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 1,
      sellPrice: Number.isFinite(sellPrice) && sellPrice >= 0 ? sellPrice : 0,
      costPrice: Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0,
      taxable: Boolean(x.taxable ?? true),
      active: Boolean(x.active ?? true),
      createdAt,
      updatedAt,
    };
  };

  return arr.map(normalize).filter(Boolean) as WorkMaster[];
}

function saveAll(items: WorkMaster[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

function calcProfit(item: WorkMaster) {
  return item.sellPrice - item.costPrice;
}
function calcProfitRate(item: WorkMaster) {
  if (item.sellPrice <= 0) return 0;
  return (item.sellPrice - item.costPrice) / item.sellPrice;
}

function formatDate10(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return new Date(t).toISOString().slice(0, 10);
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ========= Form =========
type FormState = {
  name: string;
  category: string;
  unit: string;
  defaultQty: string;
  sellPrice: string;
  costPrice: string;
  taxable: boolean;
  active: boolean;
};

function emptyForm(): FormState {
  return {
    name: "",
    category: "整備",
    unit: "回",
    defaultQty: "1",
    sellPrice: "0",
    costPrice: "0",
    taxable: true,
    active: true,
  };
}

function validateForm(f: FormState): string | null {
  if (!f.name.trim()) return "作業名は必須です";
  const dq = Number(f.defaultQty);
  if (!Number.isFinite(dq) || dq <= 0) return "初期数量は 1 以上の数値にしてください";
  const sp = Number(f.sellPrice);
  if (!Number.isFinite(sp) || sp < 0) return "売価は 0 以上の数値にしてください";
  const cp = Number(f.costPrice);
  if (!Number.isFinite(cp) || cp < 0) return "原価は 0 以上の数値にしてください";
  return null;
}

type SortKey = "updated_desc" | "updated_asc" | "name_asc" | "profit_desc";

function uniqueCategories(items: WorkMaster[]): string[] {
  const set = new Set<string>();
  for (const x of items) {
    const c = (x.category ?? "").trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

function toneForActive(active: boolean): "default" | "secondary" | "destructive" {
  return active ? "default" : "secondary";
}

// ========= Modal (simple) =========
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] grid place-items-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] rounded-2xl border bg-background p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold">{title}</div>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function Page() {
  const [items, setItems] = useState<WorkMaster[]>(() => loadAll());

  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("updated_desc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useMemo(() => uniqueCategories(items), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = items;

    if (!showInactive) list = list.filter((x) => x.active);

    if (category !== "all") {
      list = list.filter((x) => (x.category ?? "").trim() === category);
    }

    if (q) {
      list = list.filter((x) => {
        const hay = `${x.name} ${x.category} ${x.unit}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const byUpdatedDesc = (a: WorkMaster, b: WorkMaster) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    const byUpdatedAsc = (a: WorkMaster, b: WorkMaster) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    const byNameAsc = (a: WorkMaster, b: WorkMaster) => a.name.localeCompare(b.name, "ja");
    const byProfitDesc = (a: WorkMaster, b: WorkMaster) => calcProfit(b) - calcProfit(a);

    const sorter =
      sort === "updated_asc"
        ? byUpdatedAsc
        : sort === "name_asc"
        ? byNameAsc
        : sort === "profit_desc"
        ? byProfitDesc
        : byUpdatedDesc;

    return [...list].sort(sorter);
  }, [items, query, showInactive, category, sort]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (wm: WorkMaster) => {
    setEditingId(wm.id);
    setForm({
      name: wm.name,
      category: wm.category || "整備",
      unit: wm.unit || "回",
      defaultQty: String(wm.defaultQty),
      sellPrice: String(wm.sellPrice),
      costPrice: String(wm.costPrice),
      taxable: wm.taxable,
      active: wm.active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const upsert = () => {
    const err = validateForm(form);
    if (err) {
      setFormError(err);
      return;
    }

    const now = nowIso();
    const existing = editingId ? items.find((x) => x.id === editingId) : null;

    const nextItem: WorkMaster = {
      id: editingId ?? uid(),
      name: form.name.trim(),
      category: form.category.trim(),
      unit: form.unit.trim() || "回",
      defaultQty: Number(form.defaultQty),
      sellPrice: Number(form.sellPrice),
      costPrice: Number(form.costPrice),
      taxable: form.taxable,
      active: form.active,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const next = !editingId ? [nextItem, ...items] : items.map((x) => (x.id === editingId ? nextItem : x));
    setItems(next);
    saveAll(next);
    closeModal();
  };

  const toggleActive = (id: string) => {
    const next = items.map((x) => {
      if (x.id !== id) return x;
      return { ...x, active: !x.active, updatedAt: nowIso() };
    });
    setItems(next);
    saveAll(next);
  };

  const duplicate = (id: string) => {
    const src = items.find((x) => x.id === id);
    if (!src) return;
    const now = nowIso();
    const copy: WorkMaster = {
      ...src,
      id: uid(),
      name: `${src.name}（コピー）`,
      createdAt: now,
      updatedAt: now,
      active: true,
    };
    const next = [copy, ...items];
    setItems(next);
    saveAll(next);
  };

  const remove = (id: string) => {
    const target = items.find((x) => x.id === id);
    if (!target) return;

    const ok = window.confirm(`「${target.name}」を削除しますか？（元に戻せません）`);
    if (!ok) return;

    const next = items.filter((x) => x.id !== id);
    setItems(next);
    saveAll(next);
  };

  // 初期データ投入（デモ）
  const seed = () => {
    const now = nowIso();
    const demo: WorkMaster[] = [
      {
        id: uid(),
        name: "オイル交換",
        category: "整備",
        unit: "回",
        defaultQty: 1,
        sellPrice: 6000,
        costPrice: 3000,
        taxable: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        name: "ウォッシャー液補充",
        category: "消耗品",
        unit: "本",
        defaultQty: 1,
        sellPrice: 600,
        costPrice: 250,
        taxable: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        name: "車検作業",
        category: "点検",
        unit: "回",
        defaultQty: 1,
        sellPrice: 25000,
        costPrice: 0,
        taxable: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    if (items.length > 0) {
      const ok = window.confirm("作業マスタに既にデータがあります。デモを追加しますか？");
      if (!ok) return;
    }
    const next = [...demo, ...items];
    setItems(next);
    saveAll(next);
  };

  const exportJson = () => {
    const payload = {
      version: 1,
      exportedAt: nowIso(),
      items,
    };
    downloadText(`vlp_work_masters_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = safeParseJson<any>(text, null);
    if (!parsed) {
      alert("JSONの読み込みに失敗しました");
      return;
    }

    const rawItems = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
    if (!rawItems) {
      alert("JSON形式が不正です（items配列がありません）");
      return;
    }

    // normalize via loadAll-compatible logic
    const normalized = rawItems
      .map((x: any) => {
        if (!x || typeof x !== "object") return null;
        const name = String(x.name ?? "").trim();
        if (!name) return null;

        const unit = String(x.unit ?? "回").trim() || "回";
        const category = String(x.category ?? "").trim();
        const createdAt = String(x.createdAt ?? x.created_at ?? nowIso());
        const updatedAt = String(x.updatedAt ?? x.updated_at ?? createdAt);

        const sellPrice = Number(x.sellPrice ?? 0);
        const costPrice = Number(x.costPrice ?? 0);
        const defaultQty = Number(x.defaultQty ?? 1);

        return {
          id: String(x.id ?? uid()),
          name,
          category,
          unit,
          defaultQty: Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 1,
          sellPrice: Number.isFinite(sellPrice) && sellPrice >= 0 ? sellPrice : 0,
          costPrice: Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0,
          taxable: Boolean(x.taxable ?? true),
          active: Boolean(x.active ?? true),
          createdAt,
          updatedAt,
        } as WorkMaster;
      })
      .filter(Boolean) as WorkMaster[];

    if (normalized.length === 0) {
      alert("取り込める作業マスタが見つかりませんでした");
      return;
    }

    const ok = window.confirm(`JSONから ${normalized.length} 件を取り込みます。\n現在のデータに「上書き」しますか？（OK=上書き / キャンセル=追加）`);
    const next = ok ? normalized : [...normalized, ...items];

    setItems(next);
    saveAll(next);
    alert("取り込み完了");
  };

  const counts = useMemo(() => {
    const all = items.length;
    const active = items.filter((x) => x.active).length;
    const inactive = all - active;
    return { all, active, inactive };
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">各種マスタ登録（作業マスタ）</div>
          <div className="text-sm text-muted-foreground">
            {filtered.length} 件（全{counts.all} / 有効{counts.active} / 無効{counts.inactive}）
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={seed}>デモ投入</Button>

          <Button variant="outline" onClick={exportJson}>JSON書き出し</Button>

          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void importJson(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" type="button">JSON取り込み</Button>
          </label>

          <Button onClick={openCreate}>+ 作業を追加</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">検索 / 絞り込み</CardTitle>
          <CardDescription>作業名 / カテゴリ / 単位</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索（作業名/カテゴリ/単位）"
            className="md:col-span-2"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm shadow-sm"
          >
            <option value="all">カテゴリ: 全て</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                カテゴリ: {c}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              無効も表示
            </label>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 rounded-md border bg-background px-3 text-sm shadow-sm"
            >
              <option value="updated_desc">並び: 更新日（新しい順）</option>
              <option value="updated_asc">並び: 更新日（古い順）</option>
              <option value="name_asc">並び: 作業名（A→Z）</option>
              <option value="profit_desc">並び: 粗利（高い順）</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">作業マスタ一覧</CardTitle>
          <CardDescription>粗利・粗利率も表示</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">
              データがありません。右上から追加できます。
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>作業</TableHead>
                    <TableHead>カテゴリ</TableHead>
                    <TableHead>単位/初期</TableHead>
                    <TableHead className="text-right">売価</TableHead>
                    <TableHead className="text-right">原価</TableHead>
                    <TableHead className="text-right">粗利</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filtered.map((wm) => {
                    const profit = calcProfit(wm);
                    const rate = calcProfitRate(wm);
                    return (
                      <TableRow key={wm.id} className={!wm.active ? "opacity-60" : ""}>
                        <TableCell className="min-w-[240px]">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{wm.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {wm.taxable ? "課税" : "非課税"} / 更新: {formatDate10(wm.updatedAt)}
                              </div>
                            </div>

                            <Badge variant={toneForActive(wm.active)} className="whitespace-nowrap">
                              {wm.active ? "有効" : "無効"}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="min-w-[120px]">{wm.category || "-"}</TableCell>

                        <TableCell className="min-w-[120px]">
                          {wm.unit} / {wm.defaultQty}
                        </TableCell>

                        <TableCell className="text-right tabular-nums">{yen(wm.sellPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{yen(wm.costPrice)}</TableCell>

                        <TableCell className="text-right tabular-nums">
                          <div className="font-semibold">{yen(profit)}</div>
                          <div className="text-xs text-muted-foreground">{(rate * 100).toFixed(1)}%</div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="inline-flex gap-2 flex-wrap justify-end">
                            <Button size="sm" variant="outline" onClick={() => openEdit(wm)}>
                              編集
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => duplicate(wm.id)}>
                              複製
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => toggleActive(wm.id)}>
                              {wm.active ? "無効" : "有効"}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => remove(wm.id)}>
                              削除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {modalOpen ? (
        <Modal title={editingId ? "作業を編集" : "作業を追加"} onClose={closeModal}>
          {formError ? (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">作業名 *</div>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">カテゴリ</div>
              <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">単位</div>
              <Input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">初期数量 *</div>
              <Input
                inputMode="numeric"
                value={form.defaultQty}
                onChange={(e) => setForm((p) => ({ ...p, defaultQty: e.target.value }))}
              />
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">売価（税抜）*</div>
              <Input
                inputMode="numeric"
                value={form.sellPrice}
                onChange={(e) => setForm((p) => ({ ...p, sellPrice: e.target.value }))}
              />
            </label>

            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">原価（仕入）*</div>
              <Input
                inputMode="numeric"
                value={form.costPrice}
                onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.taxable}
                onChange={(e) => setForm((p) => ({ ...p, taxable: e.target.checked }))}
              />
              課税
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
              />
              有効
            </label>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={closeModal}>
                キャンセル
              </Button>
              <Button onClick={upsert}>保存</Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Footer tips */}
      <div className="text-xs text-muted-foreground">
        ※ このページは一旦 localStorage 保存です（後でAPI連携に差し替え可能）。JSON取り込み/書き出しで移行もできます。
      </div>
    </div>
  );
}