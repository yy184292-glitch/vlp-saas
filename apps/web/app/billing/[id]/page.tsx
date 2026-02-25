"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type BillingDoc = {
  id: string;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  status: "draft" | "issued" | "void" | string;
  kind: "estimate" | "invoice" | string;
  created_at: string;
};

type BillingLine = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
};

type BillingLineIn = {
  name: string;
  qty: number;
  unit_price?: number;
};

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) throw new Error("API_BASE not set");
  return API_BASE;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(n);
}

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState("");
  const [draftKind, setDraftKind] = useState<"invoice" | "estimate">("invoice");
  const [draftStatus, setDraftStatus] =
    useState<"draft" | "issued" | "void">("draft");
  const [draftLines, setDraftLines] = useState<BillingLineIn[]>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const previewTotal = useMemo(() => {
    return draftLines.reduce((sum, ln) => {
      return sum + safeNumber(ln.qty) * safeNumber(ln.unit_price);
    }, 0);
  }, [draftLines]);

  async function reload() {
    const [docRes, lineRes] = await Promise.all([
      fetchJson<BillingDoc>(`/api/v1/billing/${id}`),
      fetchJson<BillingLine[]>(`/api/v1/billing/${id}/lines`),
    ]);

    setDoc(docRes);
    setLines(lineRes);

    setDraftCustomer(docRes.customer_name ?? "");
    setDraftKind(
      docRes.kind === "estimate" ? "estimate" : "invoice"
    );
    setDraftStatus(
      docRes.status === "issued"
        ? "issued"
        : docRes.status === "void"
        ? "void"
        : "draft"
    );

    setDraftLines(
      lineRes.map((l) => ({
        name: l.name,
        qty: l.qty,
        unit_price: l.unit_price,
      }))
    );
  }

  useEffect(() => {
    if (!id) return;

    reload().finally(() => setLoading(false));
  }, [id]);

  function addLine() {
    setDraftLines([...draftLines, { name: "明細", qty: 1, unit_price: 0 }]);
  }

  function updateLine(idx: number, patch: Partial<BillingLineIn>) {
    setDraftLines(
      draftLines.map((l, i) =>
        i === idx ? { ...l, ...patch } : l
      )
    );
  }

  function removeLine(idx: number) {
    setDraftLines(draftLines.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!doc) return;

    setSaving(true);

    try {
      await fetchJson(`/api/v1/billing/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify({
          customer_name: draftCustomer,
          kind: draftKind,
          status: draftStatus,
          lines: draftLines,
        }),
      });

      setMsg("保存しました");
      setEditing(false);
      await reload();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc() {
    if (!doc) return;

    if (!confirm("削除しますか？")) return;

    await fetchJson(`/api/v1/billing/${doc.id}`, {
      method: "DELETE",
    });

    router.push("/billing");
  }

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!doc) return <main style={{ padding: 24 }}>Not found</main>;

  return (
    <main style={{ padding: 24 }}>
      <button onClick={() => router.push("/billing")}>
        ← 一覧へ
      </button>

      <h1>請求詳細</h1>

      {msg && <p>{msg}</p>}

      <div>
        顧客:
        {!editing ? (
          doc.customer_name
        ) : (
          <input
            value={draftCustomer}
            onChange={(e) =>
              setDraftCustomer(e.target.value)
            }
          />
        )}
        <br />

        種別:
        {!editing ? (
          doc.kind
        ) : (
          <select
            value={draftKind}
            onChange={(e) =>
              setDraftKind(e.target.value as any)
            }
          >
            <option value="invoice">invoice</option>
            <option value="estimate">estimate</option>
          </select>
        )}

        <br />

        状態:
        {!editing ? (
          doc.status
        ) : (
          <select
            value={draftStatus}
            onChange={(e) =>
              setDraftStatus(e.target.value as any)
            }
          >
            <option value="draft">draft</option>
            <option value="issued">issued</option>
            <option value="void">void</option>
          </select>
        )}
      </div>

      <h2>明細</h2>

      {editing && <button onClick={addLine}>追加</button>}

      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>数量</th>
            <th>単価</th>
            <th>金額</th>
            {editing && <th />}
          </tr>
        </thead>

        <tbody>
          {(editing ? draftLines : lines).map((l: any, idx) => {
            const amount = safeNumber(l.qty) * safeNumber(l.unit_price);

            return (
              <tr key={idx}>
                <td>
                  {!editing ? (
                    l.name
                  ) : (
                    <input
                      value={l.name}
                      onChange={(e) =>
                        updateLine(idx, {
                          name: e.target.value,
                        })
                      }
                    />
                  )}
                </td>

                <td>
                  {!editing ? (
                    l.qty
                  ) : (
                    <input
                      value={l.qty}
                      onChange={(e) =>
                        updateLine(idx, {
                          qty: safeNumber(e.target.value),
                        })
                      }
                    />
                  )}
                </td>

                <td>
                  {!editing ? (
                    yen(l.unit_price)
                  ) : (
                    <input
                      value={l.unit_price}
                      onChange={(e) =>
                        updateLine(idx, {
                          unit_price: safeNumber(
                            e.target.value
                          ),
                        })
                      }
                    />
                  )}
                </td>

                <td>{yen(amount)}</td>

                {editing && (
                  <td>
                    <button
                      onClick={() =>
                        removeLine(idx)
                      }
                    >
                      削除
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>
        合計:{" "}
        {editing
          ? yen(previewTotal)
          : yen(doc.total)}
      </h2>

      {!editing ? (
        <>
          <button onClick={() => setEditing(true)}>
            編集
          </button>

          <button onClick={removeDoc}>
            削除
          </button>
        </>
      ) : (
        <>
          <button onClick={save} disabled={saving}>
            保存
          </button>

          <button
            onClick={() => setEditing(false)}
          >
            キャンセル
          </button>
        </>
      )}
    </main>
  );
}
