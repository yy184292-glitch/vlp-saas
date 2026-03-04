// Auth domain: login, register, me, invites
import { apiFetch, ApiError } from "./core";

export type LoginResponse = {
  access_token?: string;
  token_type?: string;
  user_id?: string;
  store_id?: string;
  role?: string;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const friendly =
      typeof data?.detail === "string" ? data.detail : `ログインに失敗しました (${res.status})`;
    throw new ApiError({ status: res.status, url: "/api/auth/login", message: friendly, detail: data });
  }

  return data as LoginResponse;
}

export type RegisterOwnerPayload = {
  store: {
    name: string;
    prefecture: string;
    address1?: string;
    address2?: string;
    phone?: string;
    zip?: string;
  };
  owner: {
    name: string;
    email: string;
    password: string;
  };
};

type StoreCreateRequest = {
  name: string;
  prefecture: string;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  tel?: string | null;
  email?: string | null;
};

type StoreCreateResponse = {
  id: string;
};

function utf8ByteLength(s: string): number {
  try {
    return new TextEncoder().encode(s).length;
  } catch {
    return s.length;
  }
}

export async function registerOwner(payload: RegisterOwnerPayload): Promise<any> {
  const storeName = payload.store.name.trim();
  const prefecture = payload.store.prefecture.trim();
  const ownerName = payload.owner.name.trim();
  const ownerEmail = payload.owner.email.trim();
  const ownerPassword = payload.owner.password;

  if (!storeName) throw new Error("店舗名は必須です");
  if (!prefecture) throw new Error("都道府県は必須です");
  if (!ownerName) throw new Error("氏名は必須です");
  if (!ownerEmail) throw new Error("メールは必須です");
  if (!ownerPassword) throw new Error("パスワードは必須です");

  if (utf8ByteLength(ownerPassword) > 72) {
    throw new Error("パスワードが長すぎます（72バイト以内にしてください）");
  }

  const storeReq: StoreCreateRequest = {
    name: storeName,
    prefecture,
    postal_code: payload.store.zip?.trim() || null,
    address1: payload.store.address1?.trim() || null,
    address2: payload.store.address2?.trim() || null,
    tel: payload.store.phone?.trim() || null,
    email: null,
  };

  const store = await apiFetch<StoreCreateResponse>("/api/v1/stores", {
    method: "POST",
    auth: false,
    body: storeReq,
  });

  if (!store?.id) {
    throw new Error("店舗作成に失敗しました（store_id が取得できません）");
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem("store_id", store.id);
    } catch {
      // ignore
    }
  }

  return await apiFetch<any>("/api/v1/auth/register-owner", {
    method: "POST",
    auth: false,
    body: {
      email: ownerEmail,
      password: ownerPassword,
      name: ownerName,
      store_id: store.id,
    },
  });
}

export async function registerWithInvite(input: {
  invite_code: string;
  email: string;
  password: string;
  name: string;
}): Promise<any> {
  if (!input.invite_code?.trim()) throw new Error("招待コードは必須です");
  if (!input.email?.trim()) throw new Error("メールは必須です");
  if (!input.password) throw new Error("パスワードは必須です");
  if (!input.name?.trim()) throw new Error("氏名は必須です");

  if (utf8ByteLength(input.password) > 72) {
    throw new Error("パスワードが長すぎます（72バイト以内にしてください）");
  }

  return await apiFetch<any>("/api/v1/auth/register-invite", {
    method: "POST",
    auth: false,
    body: {
      invite_code: input.invite_code.trim(),
      email: input.email.trim(),
      password: input.password,
      name: input.name.trim(),
    },
  });
}

export type Me = {
  id: string;
  email: string;
  store_id: string;
  role: "admin" | "manager" | "staff" | string;
};

export async function getMe(): Promise<Me> {
  return await apiFetch<Me>("/api/v1/users/me", { method: "GET", auth: true, cache: "no-store" });
}

export type Seats = {
  store_id: string;
  plan_code: string;
  seat_limit: number;
  active_users: number;
};

export type Invite = {
  id: string;
  store_id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  created_at: string;
};

export async function getSeats(): Promise<Seats> {
  return await apiFetch<Seats>("/api/v1/invites/seats", { method: "GET", auth: true, cache: "no-store" });
}

export async function listInvites(): Promise<Invite[]> {
  return await apiFetch<Invite[]>("/api/v1/invites", { method: "GET", auth: true, cache: "no-store" });
}

export async function createInvite(input?: {
  role?: string;
  max_uses?: number;
  code_length?: number;
  expires_at?: string | null;
}): Promise<Invite> {
  return await apiFetch<Invite>("/api/v1/invites", {
    method: "POST",
    auth: true,
    body: {
      role: input?.role ?? "staff",
      max_uses: input?.max_uses ?? 1,
      code_length: input?.code_length ?? 10,
      expires_at: input?.expires_at ?? null,
    },
  });
}
