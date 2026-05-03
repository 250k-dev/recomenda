import { api } from "@/lib/http/axios";
import type { LoginResponse } from "@/types/auth";
import type { PaginatedResponse, PlanQuota } from "@/lib/api/types";

export interface Farm {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

export interface Producer {
  id: string;
  name: string;
  email: string;
}

export interface Season {
  id: string;
  crop: string;
  status: string;
  plot_name: string;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
}

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

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function getPlanQuota() {
  const { data } = await api.get<PlanQuota>("/agronomists/me/plan");
  return data;
}

export async function getFarms() {
  const { data } = await api.get<PaginatedResponse<Farm>>("/farms");
  return data;
}

export async function getProducers() {
  const { data } = await api.get<PaginatedResponse<Producer>>("/producers");
  return data;
}

export async function impersonateProducer(producerId: string) {
  const { data } = await api.post<{ access_token: string }>(
    `/auth/impersonate/${producerId}`,
  );
  return data;
}

export async function exitImpersonation() {
  await api.post("/auth/impersonate/exit");
}

export async function getLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/local");
  return data;
}

export async function getGlobalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/global");
  return data;
}

export async function getSeasons() {
  const { data } = await api.get<PaginatedResponse<Season>>("/seasons");
  return data;
}

export async function getTimeline(seasonId: string) {
  const { data } = await api.get(`/seasons/${seasonId}/timeline`);
  return data;
}

export async function createSeason(payload: Record<string, unknown>) {
  const { data } = await api.post("/seasons", payload);
  return data;
}

export async function getNotifications() {
  const { data } = await api.get("/notifications");
  return data;
}
