"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ========= Types =========
type WorkMaster = {
  id: string;
  name: string;
  category: string;
  unit: string;
  defaultQty: number;
  sellPrice: number;
  costPrice: number;
  taxable: boolean;
  active: boolean;
  updatedAt: string;
  createdAt: string;
};

type WorkOrderStatus = "draft" | "in_progress" | "done";

type WorkOrderLine = {
  id: string;
  workMasterId: string;

  // snapshot
  name: string;
  category: string;
  unit: string;
  sellPrice: number;
  costPrice: number;
  taxable: boolean;

  qty: number;
  doneAt: string | null;

  createdAt: string;
  updatedAt: string;
};

type WorkOrder = {
  id: string;
  title: string;
  status: WorkOrderStatus;
  plannedAt: string | null; // YYYY-MM-DD
  dueAt: string | null; // YYYY-MM-DD
  memo: string;

  lines: WorkOrderLine[];

  createdAt: string;
  updatedAt: string;
};

// ========= Storage Keys =========
const WORK_MASTERS_KEY = "vlp_work_masters_v1";
const WORK_ORDERS_KEY = "vlp_work_orders_v1";
const BILLING_DRAFTS_KEY = "vlp_billing_drafts_v1"; // まずは下書きとして保存

// ========= Utils =========
function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadWorkMasters(): WorkMaster[] {
  if (typeof window === "undefined") return [];
  const arr = safeParseJson<unknown[]>(window.localStorage.getItem(WORK_MASTERS_KEY), []);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => {
      if (!x || typeof x !== "object") return null;
      const name = String(x.name ?? "").trim();
      if (!name) return null;
      return {
        id: String(x.id),
        name,
        category: String(x.category ?? ""),
        unit: String(x.unit ?? "回"),
        defaultQty: Number(x.defaultQty ?? 1),
        sellPrice: Number(x.sellPrice ?? 0),
        costPrice: Number(x.costPrice ?? 0),
        taxable: Boolean(x.taxable ?? true),
        active: Boolean(x.active ?? true),
        updatedAt: String(x.updatedAt ?? nowIso()),
        createdAt: String(x.createdAt ?? nowIso()),
      } as WorkMaster;
    })
    .filter(Boolean) as WorkMaster[];
}

function loadWorkOrders(): WorkOrder[] {
  if (typeof window === "undefined") return [];
  const arr = safeParseJson<unknown[]>(window.localStorage.getItem(WORK_ORDERS_KEY), []);
  if (!Array.isArray(arr)) return [];

  const normalizeLine = (x: any): WorkOrderLine | null => {
    if (!x || typeof x !== "object") return null;
    const name = String(x.name ?? "").trim();
    if (!name) return null;
    return {
      id: String(x.id ?? uid("wol")),
      workMasterId: String(x.workMasterId ?? x.work_master_id ?? ""),
      name,
      category: String(x.category ?? ""),
      unit: String(x.unit ?? "回"),
      sellPrice: Number(x.sellPrice ?? 0),
      costPrice: Number(x.costPrice ?? 0),
      taxable: Boolean(x.taxable ?? true),
      qty: Number(x.qty ?? 1),
      doneAt: x.doneAt ? String(x.doneAt) : null,
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    };
  };

  const normalize = (x: any): WorkOrder | null => {
    if (!x || typeof x !== "object") return null;
    const id = String(x.id ?? uid("wo"));
    const title = String(x.title ?? "").trim();
    if (!title) return null;

    const linesRaw = Array.isArray(x.lines) ? x.lines : [];
    const lines = linesRaw.map(normalizeLine).filter(Boolean) as WorkOrderLine[];

    const status = (String(x.status ?? "draft") as WorkOrderStatus) || "draft";

    return {
      id,
      title,
      status,
      plannedAt: x.plannedAt ? String(x.plannedAt) : null,
      dueAt: x.dueAt ? String(x.dueAt) : null,
      memo: String(x.memo ?? ""),
      lines,
      createdAt: String(x.createdAt ?? nowIso()),
      updatedAt: String(x.updatedAt ?? nowIso()),
    };
  };

  return arr.map(normalize).filter(Boolean) as WorkOrder[];
}

function saveWorkOrders(items: WorkOrder[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORK_ORDERS_KEY, JSON.stringify(items));
}

function yen(n: number) {
  return `¥${Math.round(n).toLocaleString()}`;
}

function computeTotals(lines: WorkOrderLine[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.sellPrice, 0);
  const cost = lines.reduce((sum, l) => sum + l.qty * l.costPrice, 0);
  const profit = subtotal - cost;
  const profitRate = subtotal > 0 ? profit / subtotal : 0;
  return { subtotal, cost, profit, profitRate };
}

function statusTone(s: WorkOrderStatus): "default" | "secondary" | "destructive" {
  if (s === "done") return "secondary";
  if (s === "in_progress") return "default";
  return "destructive";
}

function statusLabel(s: WorkOrderStatus): string {
  if (s === "done") return "完了";
  if (s === "in_progress") return "進行中";
  return "下書き";
}

// ========= Ten-key modal =========
function TenKeyModal({
  title,
  unit,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  unit: string;
  initial: number;
  onClose: () => void;
  onSubmit: (qty: number) => void;
}) {
  const [value, setValue] = useState<string>(String(initial));

  const append = (s: string) => {
    setValue((prev) => {
      if (prev === "0") return s;
      return prev + s;
    });
  };

  const backspace = () => setValue((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
  const clear = () => setValue("0");

  const submit = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    onSubmit(n);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[300] grid place-items-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-2xl border bg-background p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold">{title}</div>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">数量（{unit}）</div>
          <div className="text-3xl font-extrabold tabular-nums">{value}</div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((n) => (
            <Button
              key={n}
              variant="outline"
              className="h-12 text-lg font-extrabold"
              onClick={() => append(n)}
            >
              {n}
            </Button>
          ))}
          <Button variant="outline" className="h-12 font-extrabold" onClick={clear}>
            C
          </Button>
          <Button variant="outline" className="h-12 text-lg font-extrabold" onClick={() => append("0")}>
            0
          </Button>
          <Button variant="outline" className="h-12 font-extrabold" onClick={backspace}>
            ⌫
          </Button>
        </div>

        <Button className="mt-3 h-12 w-full text-base font-extrabold" onClick={submit}>
          確定
        </Button>

        <div className="mt-2 text-xs text-muted-foreground">※ 1以上の数値のみ確定できます</div>
      </div>
    </div>
  );
}

// ========= Create modal =========
function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (args: { title: string; plannedAt: string; dueAt: string; memo: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [plannedAt, setPlannedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[250] grid place-items-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-2xl border bg-background p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-base font-extrabold">指示書 新規作成</div>
          <Button variant="outline" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <div className="text-xs text-muted-foreground">タイトル *</div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: プリウス 12ヶ月点検"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">入庫日</div>
              <Input value={plannedAt} onChange={(e) => setPlannedAt(e.target.value)} placeholder="YYYY-MM-DD" />
            </label>
            <label className="grid gap-1">
              <div className="text-xs text-muted-foreground">期限</div>
              <Input value={dueAt} onChange={(e) => setDueAt(e.target.value)} placeholder="YYYY-MM-DD" />
            </label>
          </div>

          <label className="grid gap-1">
            <div className="text-xs text-muted-foreground">メモ</div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={() => onCreate({ title, plannedAt, dueAt, memo })}
              disabled={!title.trim()}
            >
              作成
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  const [masters, setMasters] = useState<WorkMaster[]>(() => loadWorkMasters().filter((x) => x.active));
  const [orders, setOrders] = useState<WorkOrder[]>(() => loadWorkOrders());
  const [selectedId, setSelectedId] = useState<string | null>(orders[0]?.id ?? null);

  const [qOrder, setQOrder] = useState("");
  const [qMaster, setQMaster] = useState("");

  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all");

  const selected = useMemo(
    () => (selectedId ? orders.find((o) => o.id === selectedId) ?? null : null),
    [orders, selectedId]
  );

  const filteredOrders = useMemo(() => {
    const q = qOrder.trim().toLowerCase();
    return orders
      .filter((o) => (statusFilter === "all" ? true : o.status === statusFilter))
      .filter((o) => (q ? `${o.title} ${o.memo}`.toLowerCase().includes(q) : true))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [orders, qOrder, statusFilter]);

  const filteredMasters = useMemo(() => {
    const q = qMaster.trim().toLowerCase();
    return masters
      .filter((m) => (q ? `${m.name} ${m.category}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masters, qMaster]);

  const refreshMasters = () => setMasters(loadWorkMasters().filter((x) => x.active));

  const persist = (next: WorkOrder[]) => {
    setOrders(next);
    saveWorkOrders(next);
  };

  const createOrder = (args: { title: string; plannedAt: string; dueAt: string; memo: string }) => {
    const title = args.title.trim();
    if (!title) return;

    const now = nowIso();
    const wo: WorkOrder = {
      id: uid("wo"),
      title,
      status: "draft",
      plannedAt: args.plannedAt.trim() ? args.plannedAt.trim() : null,
      dueAt: args.dueAt.trim() ? args.dueAt.trim() : null,
      memo: args.memo ?? "",
      lines: [],
      createdAt: now,
      updatedAt: now,
    };

    const next = [wo, ...orders];
    persist(next);
    setSelectedId(wo.id);
  };

  const updateSelected = (patch: Partial<WorkOrder>) => {
    if (!selected) return;
    const next = orders.map((o) => (o.id === selected.id ? { ...o, ...patch, updatedAt: nowIso() } : o));
    persist(next);
  };

  const addLineFromMaster = (m: WorkMaster) => {
    if (!selected) return;
    const now = nowIso();
    const line: WorkOrderLine = {
      id: uid("wol"),
      workMasterId: m.id,
      name: m.name,
      category: m.category,
      unit: m.unit,
      sellPrice: m.sellPrice,
      costPrice: m.costPrice,
      taxable: m.taxable,
      qty: m.defaultQty || 1,
      doneAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const lines = [line, ...selected.lines];
    updateSelected({ lines, status: selected.status === "done" ? "in_progress" : selected.status });
  };

  const removeLine = (lineId: string) => {
    if (!selected) return;
    const lines = selected.lines.filter((l) => l.id !== lineId);
    updateSelected({ lines });
  };

  const deleteOrder = (id: string) => {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const ok = window.confirm(`「${o.title}」を削除しますか？`);
    if (!ok) return;

    const next = orders.filter((x) => x.id !== id);
    persist(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  };

  // Ten-key
  const [tenKeyOpen, setTenKeyOpen] = useState(false);
  const [tenKeyLineId, setTenKeyLineId] = useState<string | null>(null);

  const tenKeyLine = useMemo(() => {
    if (!selected || !tenKeyLineId) return null;
    return selected.lines.find((l) => l.id === tenKeyLineId) ?? null;
  }, [selected, tenKeyLineId]);

  const openTenKey = (lineId: string) => {
    setTenKeyLineId(lineId);
    setTenKeyOpen(true);
  };

  const submitTenKey = (qty: number) => {
    if (!selected || !tenKeyLineId) return;
    const now = nowIso();

    const lines = selected.lines.map((l) => {
      if (l.id !== tenKeyLineId) return l;
      return {
        ...l,
        qty,
        doneAt: now, // タップ→数量確定＝完了扱い
        updatedAt: now,
      };
    });

    const allDone = lines.length > 0 && lines.every((l) => !!l.doneAt);
    updateSelected({ lines, status: allDone ? "done" : "in_progress" });

    setTenKeyOpen(false);
    setTenKeyLineId(null);
  };

  const markAllDone = () => {
    if (!selected) return;
    const now = nowIso();
    const lines = selected.lines.map((l) => ({ ...l, doneAt: l.doneAt ?? now, updatedAt: now }));
    updateSelected({ lines, status: lines.length > 0 ? "done" : selected.status });
  };

  const clearAllDone = () => {
    if (!selected) return;
    const now = nowIso();
    const lines = selected.lines.map((l) => ({ ...l, doneAt: null, updatedAt: now }));
    updateSelected({ lines, status: lines.length > 0 ? "in_progress" : "draft" });
  };

  const finalizeToBillingDraft = () => {
    if (!selected) return;
    if (selected.lines.length === 0) return;

    const { subtotal, cost, profit, profitRate } = computeTotals(selected.lines);

    const draft = {
      id: uid("bill"),
      createdAt: nowIso(),
      type: "invoice" as const, // とりあえず請求書扱い
      workOrderId: selected.id,
      title: selected.title,
      lines: selected.lines.map((l) => ({
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        price: l.sellPrice,
        total: l.qty * l.sellPrice,
        taxable: l.taxable,
      })),
      totals: { subtotal, cost, profit, profitRate },
      status: "draft" as const,
    };

    const prev = safeParseJson<any[]>(window.localStorage.getItem(BILLING_DRAFTS_KEY), []);
    const next = [draft, ...(Array.isArray(prev) ? prev : [])];
    window.localStorage.setItem(BILLING_DRAFTS_KEY, JSON.stringify(next));

    router.push("/billing");
  };

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const all = orders.length;
    const draft = orders.filter((o) => o.status === "draft").length;
    const prog = orders.filter((o) => o.status === "in_progress").length;
    const done = orders.filter((o) => o.status === "done").length;
    return { all, draft, prog, done };
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xl font-semibold tracking-tight">作業指示書</div>
          <div className="text-sm text-muted-foreground">
            {counts.all}件（下書き{counts.draft} / 進行中{counts.prog} / 完了{counts.done}）
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/masters">作業マスタへ</Link>
          </Button>

          <Button variant="outline" onClick={refreshMasters}>
            作業マスタ更新
          </Button>

          <Button onClick={() => setCreateOpen(true)}>+ 新規作成</Button>
        </div>
      </div>

      {/* Body 2 columns */}
      <div className="grid gap-4 lg:grid-cols-[360px_1fr] items-start">
        {/* Left: list */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">指示書一覧</CardTitle>
            <CardDescription>タイトル / メモ / ステータス</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={qOrder}
              onChange={(e) => setQOrder(e.target.value)}
              placeholder="指示書検索（タイトル/メモ）"
            />

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                全て
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "draft" ? "default" : "outline"}
                onClick={() => setStatusFilter("draft")}
              >
                下書き
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "in_progress" ? "default" : "outline"}
                onClick={() => setStatusFilter("in_progress")}
              >
                進行中
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "done" ? "default" : "outline"}
                onClick={() => setStatusFilter("done")}
              >
                完了
              </Button>
            </div>

            <div className="grid gap-2">
              {filteredOrders.length === 0 ? (
                <div className="text-sm text-muted-foreground">まだ指示書がありません。</div>
              ) : (
                filteredOrders.map((o) => {
                  const active = o.id === selectedId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedId(o.id)}
                      className={[
                        "w-full rounded-xl border p-3 text-left transition",
                        active ? "bg-muted/40 border-border" : "bg-background hover:bg-muted/30",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold leading-tight">{o.title}</div>
                        <Badge variant={statusTone(o.status)} className="whitespace-nowrap">
                          {statusLabel(o.status)}
                        </Badge>
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        入庫: {o.plannedAt ?? "-"} / 期限: {o.dueAt ?? "-"}
                      </div>

                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteOrder(o.id);
                          }}
                        >
                          削除
                        </Button>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: detail */}
        <div className="space-y-4">
          {!selected ? (
            <Card className="shadow-sm">
              <CardContent className="p-5 text-sm text-muted-foreground">
                左から指示書を選択してください。
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base">{selected.title}</CardTitle>
                      <CardDescription>
                        状態: {statusLabel(selected.status)} / 更新: {selected.updatedAt.slice(0, 10)}
                      </CardDescription>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        onClick={() =>
                          updateSelected({
                            status:
                              selected.status === "draft"
                                ? "in_progress"
                                : selected.status === "in_progress"
                                ? "done"
                                : "draft",
                          })
                        }
                      >
                        ステータス切替
                      </Button>

                      <Button variant="outline" onClick={markAllDone} disabled={selected.lines.length === 0}>
                        全て完了
                      </Button>
                      <Button variant="outline" onClick={clearAllDone} disabled={selected.lines.length === 0}>
                        完了クリア
                      </Button>

                      <Button onClick={finalizeToBillingDraft} disabled={selected.lines.length === 0}>
                        請求へ（下書き）
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <div className="text-xs text-muted-foreground">入庫日</div>
                      <Input
                        value={selected.plannedAt ?? ""}
                        onChange={(e) => updateSelected({ plannedAt: e.target.value || null })}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                    <label className="grid gap-1">
                      <div className="text-xs text-muted-foreground">期限</div>
                      <Input
                        value={selected.dueAt ?? ""}
                        onChange={(e) => updateSelected({ dueAt: e.target.value || null })}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                  </div>

                  <label className="grid gap-1">
                    <div className="text-xs text-muted-foreground">メモ</div>
                    <textarea
                      value={selected.memo}
                      onChange={(e) => updateSelected({ memo: e.target.value })}
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  {/* Totals */}
                  <div className="rounded-xl border bg-muted/20 p-3">
                    {(() => {
                      const t = computeTotals(selected.lines);
                      return (
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div>
                            <div className="text-xs text-muted-foreground">小計</div>
                            <div className="font-bold">{yen(t.subtotal)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">原価</div>
                            <div className="font-bold">{yen(t.cost)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">粗利</div>
                            <div className="font-bold">{yen(t.profit)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">粗利率</div>
                            <div className="font-bold">{(t.profitRate * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* Add from masters */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base">作業追加（作業マスタ）</CardTitle>
                      <CardDescription>タップで明細に追加</CardDescription>
                    </div>

                    <Input
                      value={qMaster}
                      onChange={(e) => setQMaster(e.target.value)}
                      placeholder="検索（オイル/車検...）"
                      className="w-full sm:w-[320px]"
                    />
                  </div>
                </CardHeader>

                <CardContent>
                  {filteredMasters.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      作業マスタがありません。/mastersで追加してください。
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredMasters.slice(0, 12).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => addLineFromMaster(m)}
                          className="rounded-2xl border bg-background p-3 text-left hover:bg-muted/30"
                        >
                          <div className="font-semibold">{m.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {m.category} / {m.unit} / 初期 {m.defaultQty}
                          </div>
                          <div className="mt-2 text-xs">
                            売価 <span className="font-semibold">{yen(m.sellPrice)}</span> / 原価{" "}
                            <span className="font-semibold">{yen(m.costPrice)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lines */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base">作業一覧</CardTitle>
                      <CardDescription>タップで数量入力 → 完了</CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">{selected.lines.length}件</div>
                  </div>
                </CardHeader>

                <CardContent>
                  {selected.lines.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      まだ作業がありません。上から追加してください。
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {selected.lines.map((l) => {
                        const done = !!l.doneAt;
                        return (
                          <div
                            key={l.id}
                            className={[
                              "rounded-2xl border p-3",
                              done ? "bg-emerald-50/60" : "bg-background",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold">{l.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {l.category} / 単位 {l.unit}
                                </div>
                              </div>
                              <Button variant="destructive" size="sm" onClick={() => removeLine(l.id)}>
                                削除
                              </Button>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">数量</div>
                              <div className="text-lg font-extrabold tabular-nums">
                                {l.qty} {l.unit}
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">金額</div>
                              <div className="font-bold">{yen(l.qty * l.sellPrice)}</div>
                            </div>

                            <Button className="mt-3 w-full" onClick={() => openTenKey(l.id)}>
                              {done ? "数量変更（再入力）" : "作業完了（数量入力）"}
                            </Button>

                            <div className="mt-2 text-xs text-muted-foreground">
                              {done ? `完了: ${l.doneAt?.slice(0, 19).replace("T", " ")}` : "未完了"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Create modal */}
      {createOpen ? (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreate={(args) => {
            createOrder(args);
            setCreateOpen(false);
          }}
        />
      ) : null}

      {/* TenKey modal */}
      {tenKeyOpen && tenKeyLine ? (
        <TenKeyModal
          title={tenKeyLine.name}
          unit={tenKeyLine.unit}
          initial={tenKeyLine.qty}
          onClose={() => {
            setTenKeyOpen(false);
            setTenKeyLineId(null);
          }}
          onSubmit={submitTenKey}
        />
      ) : null}
    </div>
  );
}