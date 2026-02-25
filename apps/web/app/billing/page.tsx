"use client";

import React, { useEffect, useMemo, useState } from "react";

type BillingStatus = "draft" | "issued" | "void";
type BillingKind = "estimate" | "invoice";

type BillingDoc = {
  id: string;
  created_at: string;
  customer_name: string | null;
  total: number;
  status: BillingStatus;
  kind: BillingKind;
};

type BillingLineIn = {
  name: string;
  qty: number;
  unit?: string;
  unit_price?: number;
  cost_price?: number;
};

type BillingCreateIn = {
  kind: BillingKind;
  status: BillingStatus;
  customer_name?: string;
  lines: BillingLineIn[];
  meta?: Record<string, unknown>;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

// ==========================
// utils
// ==========================

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status}: ${text || res.statusText}`
    );
  }

  return (await res.json()) as T;
}

function formatYen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ==========================
// component
// ==========================

export default function BillingPage() {
  const [items, setItems] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // form
  const [customerName, setCustomerName] = useState("");
  const [kind, setKind] =
    useState<BillingKind>("invoice");

  const [lines, setLines] = useState<
    BillingLineIn[]
  >([{ name: "作業費", qty: 1, unit_price: 0 }]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    null
  );

  // ==========================
  // preview total
  // ==========================

  const previewTotal = useMemo(() => {
    return lines.reduce((sum, ln) => {
      const qty = safeNumber(ln.qty);
      const price =
        ln.unit_price == null
          ? 0
          : safeNumber(ln.unit_price);
      return sum + qty * price;
    }, 0);
  }, [lines]);

  // ==========================
  // load list
  // ==========================

  async function reload() {
    setLoading(true);
    setErr(null);

    try {
      const data = await fetchJson<BillingDoc[]>(
        `${API_BASE}/api/v1/billing?limit=100&offset=0`
      );

      setItems(data);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : "load failed"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // ==========================
  // form ops
  // ==========================

  function updateLine(
    idx: number,
    patch: Partial<BillingLineIn>
  ) {
    setLines((prev) =>
      prev.map((x, i) =>
        i === idx ? { ...x, ...patch } : x
      )
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { name: "明細", qty: 1, unit_price: 0 },
    ]);
  }

  function removeLine(idx: number) {
    setLines((prev) =>
      prev.filter((_, i) => i !== idx)
    );
  }

  // ==========================
  // create billing
  // ==========================

  async function createDraft() {
    setSaving(true);
    setMsg(null);

    try {
      const body: BillingCreateIn = {
        kind,
        status: "draft",
        customer_name:
          customerName.trim() || undefined,
        lines: lines.map((ln) => ({
          name: ln.name,
          qty: safeNumber(ln.qty),
          unit: ln.unit,
          unit_price:
            ln.unit_price == null
              ? undefined
              : safeNumber(ln.unit_price),
          cost_price:
            ln.cost_price == null
              ? undefined
              : safeNumber(ln.cost_price),
        })),
        meta: {
          _ui: "billing-page",
        },
      };

      await fetchJson(
        `${API_BASE}/api/v1/billing`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      setMsg("保存しました");

      setCustomerName("");
      setLines([
        {
          name: "作業費",
          qty: 1,
          unit_price: 0,
        },
      ]);

      reload();
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "save failed"
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================
  // UI
  // ==========================

  return (
    <main style={{ padding: 24 }}>
      <h1>見積・請求（DB）</h1>

      {/* form */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          marginTop: 12,
        }}
      >
        <div>
          顧客名:
          <input
            value={customerName}
            onChange={(e) =>
              setCustomerName(
                e.target.value
              )
            }
            style={{ marginLeft: 8 }}
          />
        </div>

        <div style={{ marginTop: 8 }}>
          種別:
          <select
            value={kind}
            onChange={(e) =>
              setKind(
                e.target
                  .value as BillingKind
              )
            }
            style={{ marginLeft: 8 }}
          >
            <option value="invoice">
              invoice
            </option>
            <option value="estimate">
              estimate
            </option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={addLine}>
            明細追加
          </button>
        </div>

        <table
          style={{
            width: "100%",
            marginTop: 8,
          }}
        >
          <thead>
            <tr>
              <th>名称</th>
              <th>数量</th>
              <th>単価</th>
              <th>小計</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {lines.map((ln, idx) => {
              const amount =
                safeNumber(ln.qty) *
                safeNumber(
                  ln.unit_price
                );

              return (
                <tr key={idx}>
                  <td>
                    <input
                      value={ln.name}
                      onChange={(e) =>
                        updateLine(idx, {
                          name: e.target
                            .value,
                        })
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={ln.qty}
                      onChange={(e) =>
                        updateLine(idx, {
                          qty: safeNumber(
                            e.target
                              .value
                          ),
                        })
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={
                        ln.unit_price ??
                        ""
                      }
                      onChange={(e) =>
                        updateLine(idx, {
                          unit_price:
                            safeNumber(
                              e.target
                                .value
                            ),
                        })
                      }
                    />
                  </td>

                  <td>
                    {formatYen(
                      amount
                    )}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        removeLine(
                          idx
                        )
                      }
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 8 }}>
          合計:
          <b>
            {" "}
            {formatYen(
              previewTotal
            )}
          </b>
        </div>

        <button
          onClick={createDraft}
          disabled={saving}
          style={{
            marginTop: 8,
          }}
        >
          {saving
            ? "保存中..."
            : "DBへ保存"}
        </button>

        {msg && (
          <div style={{ marginTop: 8 }}>
            {msg}
          </div>
        )}
      </div>

      {/* list */}

      <h2 style={{ marginTop: 24 }}>
        DB一覧
      </h2>

      {loading && <div>Loading...</div>}

      {err && (
        <div style={{ color: "red" }}>
          {err}
        </div>
      )}

      {!loading && !err && (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>顧客</th>
              <th>状態</th>
              <th>合計</th>
            </tr>
          </thead>

          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>

                <td>
                  {d.customer_name ??
                    "-"}
                </td>

                <td>
                  {d.status}
                </td>

                <td>
                  {formatYen(
                    d.total
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
