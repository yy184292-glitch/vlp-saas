"use client";

import * as React from "react";
import {
  getSubscriptionStatus,
  createPortalSession,
  createCheckoutSession,
  type SubscriptionStatus,
} from "@/lib/api";
import { getMyDiscount, type MyDiscountInfo } from "@/lib/api";
import { CreditCard, RefreshCw, ExternalLink, Star, TrendingDown, Zap } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  starter: "スターター",
  standard: "スタンダード",
  pro: "プロ",
};

const PLAN_PRICES_MONTHLY: Record<string, number> = {
  starter: 9800,
  standard: 19800,
  pro: 29800,
};

const PLAN_PRICES_YEARLY: Record<string, number> = {
  starter: 105840,
  standard: 213840,
  pro: 321840,
};

function fmtMoney(n: number) { return `¥${n.toLocaleString()}`; }
function fmtDate(s: string | null | undefined) {
  if (!s) return "―";
  const d = new Date(s);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

const STATUS_LABELS: Record<string, string> = {
  active: "有効",
  trialing: "トライアル中",
  past_due: "支払い遅延",
  canceled: "キャンセル済み",
  expired: "期限切れ",
  pending: "未契約",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  trialing: "#3b82f6",
  past_due: "#ef4444",
  canceled: "#6b7280",
  expired: "#6b7280",
  pending: "#f59e0b",
};

export default function BillingPage() {
  const [sub, setSub] = React.useState<SubscriptionStatus | null>(null);
  const [discount, setDiscount] = React.useState<MyDiscountInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [upgradeLoading, setUpgradeLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([getSubscriptionStatus(), getMyDiscount()]);
      setSub(s);
      setDiscount(d);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const result = await createPortalSession({ return_url: window.location.href });
      if (result.mock) {
        alert("Stripe未設定のため、カスタマーポータルは利用できません。");
        return;
      }
      window.location.href = result.url;
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgradeYearly() {
    if (!sub) return;
    setUpgradeLoading(true);
    try {
      const result = await createCheckoutSession({
        plan: sub.plan,
        billing_cycle: "yearly",
        success_url: window.location.href + "?success=1",
        cancel_url: window.location.href,
      });
      if (result.mock) {
        alert("Stripe未設定のため、決済画面に移動できません。");
        return;
      }
      window.location.href = result.url;
    } catch (e) {
      alert("エラーが発生しました");
    } finally {
      setUpgradeLoading(false);
    }
  }

  const yearlyMonthlyEquiv = sub ? Math.round((PLAN_PRICES_YEARLY[sub.plan] ?? 0) / 12) : 0;
  const yearlyDiscount = sub ? (PLAN_PRICES_MONTHLY[sub.plan] ?? 0) * 12 - (PLAN_PRICES_YEARLY[sub.plan] ?? 0) : 0;
  const isMonthly = sub?.billing_cycle === "monthly";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px", color: "#e0e0e0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>料金・決済</h1>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>プラン・お支払い方法・請求履歴の確認</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #3a3a3a", background: "transparent", color: "#bbb", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          <RefreshCw size={14} /> 更新
        </button>
      </div>

      {/* 現在のプラン */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 12, fontWeight: 700 }}>現在のプラン</div>

        {loading ? (
          <div style={{ color: "#666", fontSize: 14 }}>読込中…</div>
        ) : sub ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 900 }}>
                  {PLAN_LABELS[sub.plan] ?? sub.plan}
                </span>
                <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: (STATUS_COLORS[sub.status] ?? "#888") + "22", color: STATUS_COLORS[sub.status] ?? "#888" }}>
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </span>
                <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#3a3a3a", color: "#aaa" }}>
                  {sub.billing_cycle === "monthly" ? "月払い" : "年払い"}
                </span>
              </div>
              {sub.current_period_end && (
                <div style={{ fontSize: 12, color: "#888" }}>
                  次回更新日: {fmtDate(sub.current_period_end)}
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#60a5fa" }}>
                {fmtMoney(sub.billing_cycle === "monthly" ? sub.monthly_price : Math.round(sub.yearly_price / 12))}<span style={{ fontSize: 13, color: "#888", fontWeight: 400 }}>/月</span>
              </div>
              {sub.billing_cycle === "yearly" && (
                <div style={{ fontSize: 11, color: "#888" }}>（年払い {fmtMoney(sub.yearly_price)}/年）</div>
              )}
              {sub.referral_discount > 0 && (
                <div style={{ fontSize: 12, color: "#34d399", marginTop: 4 }}>
                  紹介割引: -{fmtMoney(sub.referral_discount)}/月 適用中
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ color: "#666" }}>プラン情報を取得できませんでした</div>
        )}
      </div>

      {/* 紹介割引サマリー */}
      {discount && discount.monthly_discount > 0 && (
        <div style={{ background: "linear-gradient(135deg, #1a2e1a, #1e3a2a)", border: "1px solid #34d39944", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <TrendingDown size={20} color="#34d399" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>紹介割引が適用されています</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              有効紹介 {discount.active_referrals} 店舗 → -{fmtMoney(discount.monthly_discount)}/月
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>
            -{fmtMoney(discount.monthly_discount)}<span style={{ fontSize: 12, color: "#888" }}>/月</span>
          </div>
        </div>
      )}

      {/* 年払いアップセル */}
      {isMonthly && sub && (PLAN_PRICES_YEARLY[sub.plan] ?? 0) > 0 && (
        <div style={{ background: "linear-gradient(135deg, #1e3a5f, #1a2840)", border: "1px solid #3b82f644", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={16} color="#fbbf24" />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>年払いに変更して {fmtMoney(yearlyDiscount)} お得に！</span>
          </div>
          <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 14 }}>
            月払い {fmtMoney(PLAN_PRICES_MONTHLY[sub.plan] ?? 0)}/月 → 年払い {fmtMoney(yearlyMonthlyEquiv)}/月（{fmtMoney(PLAN_PRICES_YEARLY[sub.plan] ?? 0)}/年）
            <span style={{ marginLeft: 8, background: "#fbbf2422", color: "#fbbf24", padding: "1px 7px", borderRadius: 6, fontWeight: 700 }}>約2ヶ月分お得</span>
          </div>
          <button
            onClick={handleUpgradeYearly}
            disabled={upgradeLoading}
            style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {upgradeLoading ? "処理中…" : "年払いに変更する"}
          </button>
        </div>
      )}

      {/* カスタマーポータル */}
      <div style={{ background: "#2a2a2a", border: "1px solid #3a3a3a", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={16} />
          お支払い管理
        </div>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>
          支払い方法の変更・請求履歴の確認・プランのキャンセルはStripeカスタマーポータルから行えます。
        </p>
        <button
          onClick={handlePortal}
          disabled={portalLoading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          <ExternalLink size={14} />
          {portalLoading ? "処理中…" : "Stripeポータルを開く"}
        </button>
      </div>
    </div>
  );
}
