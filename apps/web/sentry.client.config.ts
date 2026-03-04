import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    // 開発環境では無効化
    enabled: process.env.NODE_ENV === "production",
    // ユーザー情報は送らない（プライバシー配慮）
    sendDefaultPii: false,
  });
}
