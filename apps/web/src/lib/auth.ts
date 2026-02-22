// lib/auth.ts

export function logoutToLogin(
  reason?: string
): void {
  if (typeof window === "undefined") return;

  const url = new URL("/login", window.location.origin);

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  window.location.href = url.toString();
}
