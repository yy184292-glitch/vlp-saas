// lib/auth.ts

const ACCESS_TOKEN_KEY = "access_token";

/**
 * アクセストークン保存
 */
export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {}
}

/**
 * アクセストークン取得
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * ログアウト
 */
export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {}
}

/**
 * ログアウトしてログイン画面へ遷移
 */
export function logoutToLogin(reason?: string): void {
  if (typeof window === "undefined") return;

  clearAccessToken();

  const url = new URL("/login", window.location.origin);

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  window.location.href = url.toString();
}