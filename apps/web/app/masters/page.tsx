"use client";

import { useMemo, useState } from "react";

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

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  // cryptoが無い環境も考慮
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

function percent(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function calcProfit(item: WorkMaster) {
  return item.sellPrice - item.costPrice;
}
function calcProfitRate(item: WorkMaster) {
  if (item.sellPrice <= 0) return 0;
  return (item.sellPrice - item.costPrice) / item.sellPrice;
}

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

export default function Page() {
  const [items, setItems] = useState<WorkMaster[]>(() => loadAll());
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((x) => (showInactive ? true : x.active))
      .filter((x) => {
        if (!q) return true;
        const hay = `${x.name} ${x.category} ${x.unit}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // 新しい順
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      });
  }, [items, query, showInactive]);

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
      createdAt: editingId ? (items.find((x) => x.id === editingId)?.createdAt ?? now) : now,
      updatedAt: now,
    };

    const next = (() => {
      if (!editingId) return [nextItem, ...items];
      return items.map((x) => (x.id === editingId ? nextItem : x));
    })();

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

    // 既にあるなら上書きしない
    if (items.length > 0) {
      const ok = window.confirm("作業マスタに既にデータがあります。デモを追加しますか？");
      if (!ok) return;
    }
    const next = [...demo, ...items];
    setItems(next);
    saveAll(next);
  };

  return (
    <main style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>各種マスタ登録（作業マスタ）</h1>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={seed} style={{ padding: "8px 12px", borderRadius: 10 }}>
            デモ投入
          </button>
          <button onClick={openCreate} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 800 }}>
            + 作業を追加
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="検索（作業名/カテゴリ/単位）"
          style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ddd", minWidth: 260 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#444" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          無効も表示
        </label>

        <div style={{ marginLeft: "auto", color: "#666", fontSize: 12 }}>
          {filtered.length}件（全{items.length}件）
        </div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 140px",
            gap: 0,
            background: "#f7f7f7",
            borderBottom: "1px solid #e5e5e5",
            padding: "10px 12px",
            fontWeight: 800,
            fontSize: 12,
            color: "#333",
          }}
        >
          <div>作業</div>
          <div>カテゴリ</div>
          <div>単位/初期</div>
          <div>売価</div>
          <div>原価</div>
          <div>粗利</div>
          <div>操作</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 12, color: "#666" }}>データがありません。右上から追加できます。</div>
        ) : (
          filtered.map((wm) => {
            const profit = calcProfit(wm);
            const rate = calcProfitRate(wm);
            return (
              <div
                key={wm.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 140px",
                  padding: "10px 12px",
                  borderBottom: "1px solid #f0f0f0",
                  alignItems: "center",
                  opacity: wm.active ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{wm.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {wm.taxable ? "課税" : "非課税"} / 更新: {wm.updatedAt.slice(0, 10)}
                  </div>
                </div>

                <div>{wm.category || "-"}</div>
                <div>
                  {wm.unit} / {wm.defaultQty}
                </div>
                <div>{yen(wm.sellPrice)}</div>
                <div>{yen(wm.costPrice)}</div>
                <div>
                  <div style={{ fontWeight: 800 }}>{yen(profit)}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{percent(rate)}</div>
                </div>

                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => openEdit(wm)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                    編集
                  </button>
                  <button onClick={() => toggleActive(wm.id)} style={{ padding: "6px 10px", borderRadius: 10 }}>
                    {wm.active ? "無効" : "有効"}
                  </button>
                  <button
                    onClick={() => remove(wm.id)}
                    style={{ padding: "6px 10px", borderRadius: 10, color: "#b00020" }}
                  >
                    削除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* モーダル */}
      {modalOpen ? (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 16,
            zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, 100%)",
              background: "#fff",
              borderRadius: 12,
              padding: 16,
              border: "1px solid #ddd",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{editingId ? "作業を編集" : "作業を追加"}</div>
              <button onClick={closeModal}>Close</button>
            </div>

            <hr style={{ margin: "12px 0" }} />

            {formError ? (
              <div style={{ color: "#b00020", marginBottom: 10, whiteSpace: "pre-wrap" }}>{formError}</div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>作業名 *</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>カテゴリ</span>
                <input
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>単位</span>
                <input
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>初期数量 *</span>
                <input
                  inputMode="numeric"
                  value={form.defaultQty}
                  onChange={(e) => setForm((p) => ({ ...p, defaultQty: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>売価（税抜）*</span>
                <input
                  inputMode="numeric"
                  value={form.sellPrice}
                  onChange={(e) => setForm((p) => ({ ...p, sellPrice: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span>原価（仕入）*</span>
                <input
                  inputMode="numeric"
                  value={form.costPrice}
                  onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                />
              </label>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.taxable}
                  onChange={(e) => setForm((p) => ({ ...p, taxable: e.target.checked }))}
                />
                課税
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                有効
              </label>
            </div>

            <hr style={{ margin: "12px 0" }} />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={closeModal} style={{ padding: "8px 12px", borderRadius: 10 }}>
                Cancel
              </button>
              <button onClick={upsert} style={{ padding: "8px 12px", borderRadius: 10, fontWeight: 900 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
