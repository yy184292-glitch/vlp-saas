"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type BillingDoc = {
  id: string;
  store_id?: string | null;
  kind: "invoice" | "estimate" | string;
  status: string;
  doc_no?: string | null;
  customer_name: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  issued_at: string | null;
  created_at: string;
};

type BillingLine = {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  amount: number;
  sort_order?: number;
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
  logo_url?: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

function getApiBaseOrThrow(): string {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL が未設定です");
  return API_BASE;
}

function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${getApiBaseOrThrow()}${path}`, {
    headers: { ...getAuthHeaders() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function yen(n: number) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ja-JP");
}

export default function BillingPrintPage() {
  const router = useRouter();
  const params = useParams();
  const id = String((params as any).id || "");

  const [doc, setDoc] = useState<BillingDoc | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [d, ls] = await Promise.all([
          fetchJson<BillingDoc>(`/api/v1/billing/${id}`),
          fetchJson<BillingLine[]>(`/api/v1/billing/${id}/lines`),
        ]);
        setDoc(d);
        setLines(ls.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));

        if (d?.store_id) {
          try {
            const st = await fetchJson<Store>(`/api/v1/stores/${d.store_id}`);
            setStore(st);
          } catch {
            // storeが取れなくても印刷は続ける
            setStore(null);
          }
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed");
      }
    })();
  }, [id]);

  const title = useMemo(() => (doc?.kind === "estimate" ? "見積書" : "請求書"), [doc?.kind]);

  if (err) return <main style={{ padding: 24, color: "crimson" }}>{err}</main>;
  if (!doc) return <main style={{ padding: 24 }}>Loading...</main>;

  const bankLine = [
    store?.bank_name,
    store?.bank_branch,
    store?.bank_account_type,
    store?.bank_account_number,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="print-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-root {
          padding: 24px;
          background: #fff;
          color: #111;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Hiragino Kaku Gothic ProN", Meiryo, "Noto Sans JP", sans-serif;
        }
        .sheet {
          max-width: 900px;
          margin: 0 auto;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 24px;
        }
        .toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }
        .btn {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .btn:hover { background: #f9fafb; }
        .header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 16px;
          margin-bottom: 16px;
        }
        .h1 {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0;
        }
        .muted { color: #6b7280; font-size: 12px; }
        .logo { height: 44px; width: auto; max-width: 240px; object-fit: contain; }
        .store {
          display: grid;
          gap: 6px;
        }
        .meta {
          display: grid;
          gap: 6px;
          text-align: right;
          font-size: 12px;
        }
        .meta-row { display: flex; gap: 8px; justify-content: flex-end; }
        .meta-key { color: #6b7280; min-width: 80px; text-align: left; }
        .meta-val { font-weight: 700; }
        .to { font-size: 14px; font-weight: 700; margin-top: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; }
        th { text-align: left; background: #f9fafb; font-weight: 700; color: #374151; }
        .right { text-align: right; }
        .totals { display: grid; justify-content: end; margin-top: 14px; gap: 6px; font-size: 12px; }
        .total-row { display: flex; gap: 16px; justify-content: space-between; min-width: 260px; }
        .total-row strong { font-size: 14px; }
        .footer { margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; display: grid; gap: 6px; font-size: 11px; color: #374151; }
      `}</style>

      <div className="toolbar no-print">
        <button className="btn" onClick={() => router.push(`/billing/${doc.id}`)}>
          ← 戻る
        </button>
        <button className="btn" onClick={() => window.print()}>
          印刷
        </button>
      </div>

      <div className="sheet">
        <div className="header">
          <div className="store">
            {store?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="logo" src={`${API_BASE}${store.logo_url}`} alt="logo" />
            ) : null}

            <h1 className="h1">{title}</h1>
            <div className="muted">※ 本書はシステムから自動生成されています</div>

            {store ? (
              <div className="muted" style={{ lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, color: "#111" }}>{store.name}</div>
                {store.postal_code || store.address1 || store.address2 ? (
                  <div>
                    {store.postal_code ? `〒${store.postal_code} ` : ""}
                    {[store.address1, store.address2].filter(Boolean).join(" ")}
                  </div>
                ) : null}
                {store.tel ? <div>TEL: {store.tel}</div> : null}
                {store.email ? <div>{store.email}</div> : null}
              </div>
            ) : null}
          </div>

          <div className="meta">
            <div className="meta-row">
              <div className="meta-key">発行日</div>
              <div className="meta-val">{formatDate(doc.issued_at ?? doc.created_at)}</div>
            </div>
            <div className="meta-row">
              <div className="meta-key">No</div>
              <div className="meta-val">{doc.doc_no ?? doc.id.slice(0, 8)}</div>
            </div>
            <div className="meta-row">
              <div className="meta-key">状態</div>
              <div className="meta-val">{doc.status}</div>
            </div>
          </div>
        </div>

        <div className="to">{doc.customer_name ? `${doc.customer_name} 御中` : "（宛先未設定）"}</div>

        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th className="right">数量</th>
              <th className="right">単価</th>
              <th className="right">金額</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td className="right">{l.qty}</td>
                <td className="right">{yen(l.unit_price)}</td>
                <td className="right">{yen(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div className="total-row">
            <span>小計</span>
            <strong>{yen(doc.subtotal)}</strong>
          </div>
          <div className="total-row">
            <span>税</span>
            <strong>{yen(doc.tax_total)}</strong>
          </div>
          <div className="total-row" style={{ fontSize: 16 }}>
            <span>合計</span>
            <strong>{yen(doc.total)}</strong>
          </div>
        </div>

        {store?.invoice_number || bankLine ? (
          <div className="footer">
            {store?.invoice_number ? <div>適格請求書発行事業者登録番号: {store.invoice_number}</div> : null}
            {bankLine ? <div>お振込先: {bankLine}{store?.bank_account_holder ? ` (${store.bank_account_holder})` : ""}</div> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
