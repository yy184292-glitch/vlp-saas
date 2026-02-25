"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 300,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #ddd",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button onClick={onClose}>Close</button>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#666" }}>数量（{unit}）</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((n) => (
            <button
              key={n}
              onClick={() => append(n)}
              style={{ padding: "16px 0", borderRadius: 12, fontSize: 18, fontWeight: 900 }}
            >
              {n}
            </button>
          ))}
          <button onClick={clear} style={{ padding: "16px 0", borderRadius: 12, fontWeight: 900 }}>
            C
          </button>
          <button onClick={() => append("0")} style={{ padding: "16px 0", borderRadius: 12, fontSize: 18, fontWeight: 900 }}>
            0
          </button>
          <button onClick={backspace} style={{ padding: "16px 0", borderRadius: 12, fontWeight: 900 }}>
            ⌫
          </button>
        </div>

        <button
          onClick={submit}
          style={{
            marginTop: 10,
            width: "100%",
            padding: 14,
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          確定
        </button>

        <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
          ※ 1以上の数値のみ確定できます
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

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPlannedAt, setNewPlannedAt] = useState<string>("");
  const [newDueAt, setNewDueAt] = useState<string>("");
  const [newMemo, setNewMemo] = useState("");

  const selected = useMemo(
    () => (selectedId ? orders.find((o) => o.id === selectedId) ?? null : null),
    [orders, selectedId]
  );

  const filteredOrders = useMemo(() => {
    const q = qOrder.trim().toLowerCase();
    const list = orders
      .filter((o) => (q ? `${o.title} ${o.memo}`.toLowerCase().includes(q) : true))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return list;
  }, [orders, qOrder]);

  const filteredMasters = useMemo(() => {
    const q = qMaster.trim().toLowerCase();
    const list = masters
      .filter((m) => (q ? `${m.name} ${m.category}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [masters, qMaster]);

  const refreshMasters = () => setMasters(loadWorkMasters().filter((x) => x.active));

  const persist = (next: WorkOrder[]) => {
    setOrders(next);
    saveWorkOrders(next);
  };

  const openCreate = () => {
    setNewTitle("");
    setNewPlannedAt("");
    setNewDueAt("");
    setNewMemo("");
    setCreateOpen(true);
  };

  const createOrder = () => {
    const title = newTitle.trim();
    if (!title) return;

    const now = nowIso();
    const wo: WorkOrder = {
      id: uid("wo"),
      title,
      status: "draft",
      plannedAt: newPlannedAt.trim() ? newPlannedAt.trim() : null,
      dueAt: newDueAt.trim() ? newDueAt.trim() : null,
      memo: newMemo,
      lines: [],
      createdAt: now,
      updatedAt: now,
    };

    const next = [wo, ...orders];
    persist(next);
    setSelectedId(wo.id);
    setCreateOpen(false);
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

  const finalizeToBillingDraft = () => {
    if (!selected) return;
    if (selected.lines.length === 0) return;

    // 完了していなくても下書きにできるが、ここではdone推奨
    const { subtotal, cost, profit, profitRate } = computeTotals(selected.lines);

    const draft = {
      id: uid("bill"),
      createdAt: nowIso(),
      type: "invoice" as const, // とりあえず請求書扱い。後で見積/請求を選べるようにする
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

    // billingへ遷移（あとで /billing で下書きを表示）
    router.push("/billing");
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

  return (
    <main style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>作業指示書</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/masters" style={{ textDecoration: "none" }}>
            <button style={{ padding: "8px 12px", borderRadius: 10 }}>作業マスタへ</button>
          </Link>
          <button onClick={refreshMasters} style={{ padding: "8px 12px", borderRadius: 10 }}>
            作業マスタ更新
          </button>
          <button onClick={openCreate} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 900 }}>
            + 新規作成
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 16, alignItems: "start" }}>
        {/* 左：指示書一覧 */}
        <div style={{ width: 360 }}>
          <input
            value={qOrder}
            onChange={(e) => setQOrder(e.target.value)}
            placeholder="指示書検索（タイトル/メモ）"
            style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
          />

          <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            {filteredOrders.length === 0 ? (
              <div style={{ padding: 12, color: "#666" }}>まだ指示書がありません。</div>
            ) : (
              filteredOrders.map((o) => {
                const active = o.id === selectedId;
                const done = o.status === "done";
                return (
                  <div
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      background: active ? "#f5f5f5" : "#fff",
                      opacity: done ? 0.8 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{o.title}</div>
                      <span
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: done ? "#e8f5e9" : "#fff",
                        }}
                      >
                        {o.status}
                      </span>
                    </div>
                    <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                      入庫: {o.plannedAt ?? "-"} / 期限: {o.dueAt ?? "-"}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button onClick={(e) => (e.stopPropagation(), deleteOrder(o.id))} style={{ borderRadius: 10 }}>
                        削除
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右：詳細 */}
        <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{ color: "#666" }}>左から指示書を選択してください。</div>
          ) : (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.title}</div>
                  <div style={{ color: "#666", fontSize: 12 }}>
                    status: {selected.status} / 更新: {selected.updatedAt.slice(0, 10)}
                  </div>
                </div>

                <button
                  onClick={finalizeToBillingDraft}
                  disabled={selected.lines.length === 0}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontWeight: 900,
                  }}
                >
                  右下完了（請求へ）
                </button>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#666" }}>入庫日</span>
                  <input
                    value={selected.plannedAt ?? ""}
                    onChange={(e) => updateSelected({ plannedAt: e.target.value || null })}
                    placeholder="YYYY-MM-DD"
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                  />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "#666" }}>期限</span>
                  <input
                    value={selected.dueAt ?? ""}
                    onChange={(e) => updateSelected({ dueAt: e.target.value || null })}
                    placeholder="YYYY-MM-DD"
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#666" }}>メモ</span>
                <textarea
                  value={selected.memo}
                  onChange={(e) => updateSelected({ memo: e.target.value })}
                  rows={3}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", resize: "vertical" }}
                />
              </label>

              <hr style={{ margin: "12px 0" }} />

              {/* 作業追加 */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>作業追加（作業マスタ）</div>
                <input
                  value={qMaster}
                  onChange={(e) => setQMaster(e.target.value)}
                  placeholder="検索（オイル/車検...）"
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd", minWidth: 260 }}
                />
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                {filteredMasters.length === 0 ? (
                  <div style={{ color: "#666" }}>作業マスタがありません。/mastersで追加してください。</div>
                ) : (
                  filteredMasters.slice(0, 12).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addLineFromMaster(m)}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid #ddd",
                        background: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>{m.name}</div>
                      <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                        {m.category} / {m.unit} / 初期 {m.defaultQty}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        売価 {yen(m.sellPrice)} / 原価 {yen(m.costPrice)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <hr style={{ margin: "12px 0" }} />

              {/* 明細（iPad操作想定：タイルをタップ→テンキー） */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>作業一覧（タップで数量入力→完了）</div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  {selected.lines.length}件
                </div>
              </div>

              {selected.lines.length === 0 ? (
                <div style={{ marginTop: 10, color: "#666" }}>まだ作業がありません。上から追加してください。</div>
              ) : (
                <>
                  <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                    {selected.lines.map((l) => {
                      const done = !!l.doneAt;
                      return (
                        <div
                          key={l.id}
                          style={{
                            padding: 12,
                            borderRadius: 16,
                            border: "1px solid #ddd",
                            background: done ? "#e8f5e9" : "#fff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 16 }}>{l.name}</div>
                              <div style={{ color: "#666", fontSize: 12 }}>
                                {l.category} / 単位 {l.unit}
                              </div>
                            </div>
                            <button onClick={() => removeLine(l.id)} style={{ color: "#b00020" }}>
                              削除
                            </button>
                          </div>

                          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "#666", fontSize: 12 }}>数量</div>
                            <div style={{ fontWeight: 900, fontSize: 20 }}>
                              {l.qty} {l.unit}
                            </div>
                          </div>

                          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ color: "#666", fontSize: 12 }}>金額</div>
                            <div style={{ fontWeight: 900 }}>{yen(l.qty * l.sellPrice)}</div>
                          </div>

                          <button
                            onClick={() => openTenKey(l.id)}
                            style={{
                              marginTop: 10,
                              width: "100%",
                              padding: 12,
                              borderRadius: 14,
                              fontWeight: 900,
                              fontSize: 16,
                            }}
                          >
                            {done ? "数量変更（再入力）" : "作業完了（数量入力）"}
                          </button>

                          <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                            {done ? `完了: ${l.doneAt?.slice(0, 19).replace("T", " ")}` : "未完了"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* totals */}
                  <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #eee", background: "#fafafa" }}>
                    {(() => {
                      const t = computeTotals(selected.lines);
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>小計</div>
                            <div style={{ fontWeight: 900 }}>{yen(t.subtotal)}</div>
                          </div>
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>原価</div>
                            <div style={{ fontWeight: 900 }}>{yen(t.cost)}</div>
                          </div>
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>粗利</div>
                            <div style={{ fontWeight: 900 }}>{yen(t.profit)}</div>
                          </div>
                          <div>
                            <div style={{ color: "#666", fontSize: 12 }}>粗利率</div>
                            <div style={{ fontWeight: 900 }}>{(t.profitRate * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {createOpen ? (
        <div
          onClick={() => setCreateOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
            zIndex: 250,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              background: "#fff",
              borderRadius: 16,
              border: "1px solid #ddd",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>指示書 新規作成</div>
              <button onClick={() => setCreateOpen(false)}>Close</button>
            </div>

            <hr style={{ margin: "12px 0" }} />

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#666" }}>タイトル *</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                placeholder="例: プリウス 12ヶ月点検"
              />
            </label>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#666" }}>入庫日</span>
                <input
                  value={newPlannedAt}
                  onChange={(e) => setNewPlannedAt(e.target.value)}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                  placeholder="YYYY-MM-DD"
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#666" }}>期限</span>
                <input
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
                  placeholder="YYYY-MM-DD"
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: "#666" }}>メモ</span>
              <textarea
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                rows={3}
                style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
              />
            </label>

            <hr style={{ margin: "12px 0" }} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setCreateOpen(false)} style={{ padding: "10px 14px", borderRadius: 12 }}>
                Cancel
              </button>
              <button
                onClick={createOrder}
                disabled={!newTitle.trim()}
                style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* TenKey modal */}
      {tenKeyOpen && tenKeyLine ? (
        <TenKeyModal
          title={tenKeyLine.name}
          unit={tenKeyLine.unit}
          initial={tenKeyLine.qty}
          onClose={() => (setTenKeyOpen(false), setTenKeyLineId(null))}
          onSubmit={submitTenKey}
        />
      ) : null}
    </main>
  );
}
