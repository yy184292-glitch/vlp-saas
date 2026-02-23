// Patch for: apps/web/src/lib/api.ts
// Add the following exports/functions to satisfy:
//   import { login } from "@/lib/api";
//
// This is a minimal, additive change. Paste near the bottom of api.ts.

/** Login request payload used by the UI. */
export type LoginInput = {
  /** Email (or username). Many FastAPI OAuth2 flows expect the key name `username`. */
  email: string;
  password: string;
};

/** Login response shape (adjust if your backend differs). */
export type LoginResponse = {
  access_token: string;
  token_type?: string;
};

/**
 * Authenticate user and return an access token.
 *
 * Notes:
 * - Uses form-encoded body to match FastAPI's OAuth2PasswordRequestForm style.
 * - Endpoint path is set to `/auth/login` by default (under your apiFetch base + /api/v1).
 *   If your backend uses `/auth/token` or `/token`, change LOGIN_PATH accordingly.
 */
const LOGIN_PATH = "/auth/login";

export async function login(input: LoginInput): Promise<LoginResponse> {
  const body = new URLSearchParams({
    // FastAPI OAuth2PasswordRequestForm expects `username` and `password`
    username: input.email,
    password: input.password,
  }).toString();

  return apiFetch<LoginResponse>(LOGIN_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}
