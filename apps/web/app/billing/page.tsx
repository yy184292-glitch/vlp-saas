"use client";

import { useEffect, useState } from "react";

/**
 * Billing Draft 型定義（MVP）
 */
type BillingDraft = {
  id: string;
  createdAt: string;
  customerName?: string;
  total: number;
  status: "draft" | "issued";
};

const STORAGE_KEY = "vlp_billing_drafts_v1";

export default function BillingPage() {
  const [drafts, setDrafts] = useState<BillingDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setDrafts([]);
        return;
      }

      const parsed: BillingDraft[] = JSON.parse(raw);

      // 日付降順ソート
      parsed.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

      setDrafts(parsed);
    } catch (err) {
      console.error("Failed to load billing drafts:", err);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>請求書</h1>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>請求書（下書き）</h1>

      {drafts.length === 0 ? (
        <p>下書きはありません</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">作成日</th>
              <th align="left">顧客</th>
              <th align="right">合計</th>
              <th align="left">状態</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{new Date(d.createdAt).toLocaleString()}</td>
                <td>{d.customerName ?? "-"}</td>
                <td align="right">
                  ¥{d.total.toLocaleString()}
                </td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
