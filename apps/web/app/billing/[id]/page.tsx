"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type BillingDoc = {
  id: string;
  store_id: string | null;
  kind: "estimate" | "invoice" | string;
  status: "draft" | "issued" | "void" | string;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  issued_at: string | null;
  created_at: string;
  updated_at?: string;
};

type BillingLine = {
  id: string;
  billing_id?: string;
  name: string;
  qty: number;
  unit?: string | null;
  unit_price: number;
  amount: number;
  sort_order?: number;
};

type BillingLineIn = {
  name: string;
  qty: number;
  unit?: string;
  unit_price?: number;
  cost_price?: number;
};

type BillingUpdateIn = {
  kind?: "estimate" | "invoice";
  status?: "draft" | "issued" | "void";
  customer_name?: string | null;
  meta?: Record<string, unknown>;
  lines?: BillingLineIn[];
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL が未設定です");
  return API_BASE;
}

/**
 * 認証がある場合:
 * - 既存の auth 実装に合わせてここを調整
 * - 例: localStorage の "access_token" を使う / cookie を使う など
 */
function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

function yen(n: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function downloadFile(path: string, filename: string) {
  try {
    const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
      headers: {
        ...getAuthHeaders(),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (e) {
    alert(e instanceof Error ? e.message : "Download failed");
  }
}

export default function BillingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id || "");

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // edit state
  const [editing, setEditing] = useState(false);
  const [draftCustomer, setDraftCustomer] = useState("");
  const [draftKind, setDraftKind] = useState<"invoice" | "estimate">("invoice");
  const [draftStatus, setDraftStatus] = useState<"draft" | "issued" | "void">("draft");
  const [draftLines, setDraftLines] = useState<BillingLineIn[]>([]);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const previewSubtotal = useMemo(() => {
    return draftLines.reduce((sum, ln) => {
      const qty = safeNumber(ln.qty, 0);
      const unit = Math.trunc(safeNumber(ln.unit_price ?? 0, 0));
      return sum + Math.trunc(qty * unit);
    }, 0);
  }, [draftLines]);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const [d, ls] = await Promise.all([
        fetchJson<BillingDoc>(`/api/v1/billing/${id}`),
        fetchJson<BillingLine[]>(`/api/v1/billing/${id}/lines`),
      ]);

      const sorted = ls.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      setDoc(d);
      setLines(sorted);

      // sync drafts
      setDraftCustomer(d.customer_name ?? "");
      setDraftKind(d.kind === "estimate" ? "estimate" : "invoice");
      setDraftStatus(d.status === "issued" ? "issued" : d.status === "void" ? "void" : "draft");
      setDraftLines(
        sorted.map((x) => ({
          name: x.name,
          qty: x.qty,
          unit: x.unit ?? undefined,
          unit_price: x.unit_price,
        }))
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEdit() {
    if (!doc) return;
    setEditing(true);
    setMsg(null);
  }

  function cancelEdit() {
    setEditing(false);
    setMsg(null);
    // 下書きは reload に任せる（簡潔）
    void reload();
  }

  function updateLine(idx: number, patch: Partial<BillingLineIn>) {
    setDraftLines((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  function addLine() {
    setDraftLines((prev) => [...prev, { name: "明細", qty: 1, unit_price: 0 }]);
  }

  function removeLine(idx: number) {
    setDraftLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!doc) return;

    setSaving(true);
    setMsg(null);

    try {
      const normalizedLines = draftLines
        .map((ln) => ({
          name: (ln.name || "").trim(),
          qty: safeNumber(ln.qty, 0),
          unit: ln.unit?.trim() || undefined,
          unit_price: ln.unit_price == null ? undefined : Math.trunc(safeNumber(ln.unit_price, 0)),
          cost_price: ln.cost_price == null ? undefined : Math.trunc(safeNumber(ln.cost_price, 0)),
        }))
        .filter((ln) => ln.name.length > 0);

      const body: BillingUpdateIn = {
        customer_name: draftCustomer.trim() || null,
        kind: draftKind,
        status: draftStatus,
        lines: normalizedLines,
      };

      await fetchJson(`/api/v1/billing/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      setEditing(false);
      setMsg("保存しました");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc() {
    if (!doc) return;
    const ok = window.confirm("この請求書を削除します。よろしいですか？");
    if (!ok) return;

    setDeleting(true);
    setMsg(null);

    try {
      await fetchJson(`/api/v1/billing/${doc.id}`, { method: "DELETE" });
      router.push("/billing");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function issue() {
    if (!doc) return;
    if (doc.status === "issued") {
      setMsg("すでに issued です");
      return;
    }

    const ok = window.confirm("この請求書を発行（issued）にします。よろしいですか？");
    if (!ok) return;

    setIssuing(true);
    setMsg(null);

    try {
      await fetchJson(`/api/v1/billing/${doc.id}/issue`, { method: "POST" });
      setMsg("発行しました");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Issue failed");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (err) return <main style={{ padding: 24, color: "crimson" }}>Error: {err}</main>;
  if (!doc) return <main style={{ padding: 24 }}>Not found</main>;

  const pdfUrl = `${API_BASE}/api/v1/billing/${doc.id}/export.pdf`;
  const csvUrl = `${API_BASE}/api/v1/billing/${doc.id}/export.csv`;

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.push("/billing")}>← 一覧へ</button>
        <h1 style={{ margin: 0 }}>請求詳細</h1>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => router.push(`/billing/${doc.id}/print`)}>印刷用</button>
          <button
            onClick={() =>
              downloadFile(`/api/v1/billing/${doc.id}/export.pdf`, `billing_${doc.id}.pdf`)
            }
          >
            PDF
          </button>

          <button
            onClick={() =>
              downloadFile(`/api/v1/billing/${doc.id}/export.csv`, `billing_${doc.id}.csv`)
            }
          >
            CSV
          </button>
          
          <button onClick={issue} disabled={issuing || doc.status === "issued"}>
            {issuing ? "発行中..." : doc.status === "issued" ? "発行済" : "発行（issued）"}
          </button>

          {!editing ? (
            <>
              <button onClick={startEdit}>編集</button>
              <button onClick={removeDoc} disabled={deleting}>
                {deleting ? "削除中..." : "削除"}
              </button>
            </>
          ) : (
            <>
              <button onClick={save} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={cancelEdit} disabled={saving}>
                キャンセル
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}

      <section style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <table>
          <tbody>
            <tr>
              <td style={{ paddingRight: 12 }}>ID</td>
              <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{doc.id}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 12 }}>顧客</td>
              <td>
                {!editing ? (
                  doc.customer_name ?? "-"
                ) : (
                  <input value={draftCustomer} onChange={(e) => setDraftCustomer(e.target.value)} style={{ width: 360 }} />
                )}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 12 }}>種別</td>
              <td>
                {!editing ? (
                  doc.kind
                ) : (
                  <select value={draftKind} onChange={(e) => setDraftKind(e.target.value as any)}>
                    <option value="invoice">invoice</option>
                    <option value="estimate">estimate</option>
                  </select>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 12 }}>状態</td>
              <td>
                {!editing ? (
                  doc.status
                ) : (
                  <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as any)}>
                    <option value="draft">draft</option>
                    <option value="issued">issued</option>
                    <option value="void">void</option>
                  </select>
                )}
              </td>
            </tr>
            <tr>
              <td style={{ paddingRight: 12 }}>合計</td>
              <td>{yen(doc.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>明細</h2>
          {editing && (
            <button onClick={addLine} style={{ marginLeft: 8 }}>
              追加
            </button>
          )}
          <div style={{ marginLeft: "auto" }}>
            {!editing ? (
              <>
                小計: <strong>{yen(doc.subtotal)}</strong> / 合計: <strong>{yen(doc.total)}</strong>
              </>
            ) : (
              <>
                小計（プレビュー）: <strong>{yen(previewSubtotal)}</strong>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">名称</th>
                <th align="right">数量</th>
                <th align="right">単価</th>
                <th align="right">金額</th>
                {editing && <th />}
              </tr>
            </thead>
            <tbody>
              {(!editing ? lines : draftLines).map((ln: any, idx: number) => {
                const qty = safeNumber(ln.qty, 0);
                const unitPrice = Math.trunc(safeNumber(ln.unit_price ?? 0, 0));
                const amount = Math.trunc(qty * unitPrice);

                return (
                  <tr key={editing ? idx : ln.id}>
                    <td>
                      {!editing ? (
                        ln.name
                      ) : (
                        <input value={ln.name} onChange={(e) => updateLine(idx, { name: e.target.value })} style={{ width: "100%" }} />
                      )}
                    </td>
                    <td align="right">
                      {!editing ? (
                        qty
                      ) : (
                        <input
                          value={ln.qty}
                          onChange={(e) => updateLine(idx, { qty: safeNumber(e.target.value, 0) })}
                          style={{ width: 80, textAlign: "right" }}
                        />
                      )}
                    </td>
                    <td align="right">
                      {!editing ? (
                        yen(unitPrice)
                      ) : (
                        <input
                          value={ln.unit_price ?? ""}
                          onChange={(e) => updateLine(idx, { unit_price: e.target.value === "" ? undefined : safeNumber(e.target.value, 0) })}
                          style={{ width: 120, textAlign: "right" }}
                        />
                      )}
                    </td>
                    <td align="right">{yen(amount)}</td>
                    {editing && (
                      <td align="right">
                        <button onClick={() => removeLine(idx)} disabled={draftLines.length <= 1}>
                          削除
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {(!editing ? lines.length === 0 : draftLines.length === 0) && (
                <tr>
                  <td colSpan={editing ? 5 : 4} style={{ padding: 10 }}>
                    明細がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
