import { api } from "@/lib/http/axios";
import type { LoginResponse } from "@/types/auth";
import type { AgronomistMePlanResponse } from "@/lib/api/types";

export async function login(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const err = body?.error ?? body;
    const e = new Error(err?.message ?? "Login failed") as Error & { code?: string };
    e.code = err?.code;
    throw e;
  }

  return (await response.json()) as LoginResponse;
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function getAuthSession() {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    return { authenticated: false, role: null as string | null };
  }
  return (await response.json()) as {
    authenticated: boolean;
    role: string | null;
  };
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function updateProfile(updates: {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string | null;
  birth_date?: string | null;
}) {
  const { data } = await api.patch("/auth/me", updates);
  return data;
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const { data } = await api.post("/auth/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

export async function getPlanQuota() {
  const { data } = await api.get<AgronomistMePlanResponse>("/agronomists/me/plan");
  return data;
}

export async function impersonateProducer(producerId: string) {
  const response = await fetch(`/api/auth/impersonate/${producerId}`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? body?.error?.message ?? "Impersonation failed");
  }
  return { ok: true as const };
}

export async function exitImpersonation(): Promise<{ ok: true; role: string | null }> {
  const response = await fetch("/api/auth/impersonate/exit", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? body?.error?.message ?? "Exit impersonation failed");
  }
  const data = (await response.json()) as { ok: true; role: string | null };
  return data;
}
