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
    throw new Error("Login failed");
  }

  return (await response.json()) as LoginResponse;
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
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
  const { data } = await api.post<{ access_token: string }>(
    `/auth/impersonate/${producerId}`,
  );
  return data;
}

function jwtPayloadRole(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function exitImpersonation(): Promise<{ access_token: string; role: string | null }> {
  const { data } = await api.post<{ access_token: string }>("/auth/impersonate/exit");
  return { access_token: data.access_token, role: jwtPayloadRole(data.access_token) };
}
