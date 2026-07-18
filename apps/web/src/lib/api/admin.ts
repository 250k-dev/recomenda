import { api } from "@/lib/http/axios";
import type { AdminProducerAccountStatus } from "@/lib/api/producers";

export interface Plan {
  id: string;
  name: string;
  plot_quota: number;
  timing_template_quota: number;
  price_brl_monthly: string;
  is_active: boolean;
}

export interface AdminAgronomist {
  user_id: string;
  name: string;
  email: string;
  plan_id: string;
  plan_started_at: string;
  active_plots_count: number;
  is_active: boolean;
}

export interface AdminAgronomistDetail {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  plan_id: string;
  plan_started_at: string;
  active_plots_count: number;
  counts: {
    farms: number;
    producers: number;
    seasons: number;
    pending_invitations: number;
  };
  farms: Array<{
    id: string;
    name: string;
    location: string | null;
    plot_count: number;
    created_at: string;
  }>;
  producers: Array<{
    producer_id: string;
    name: string;
    email: string;
    is_active: boolean;
  }>;
}

export interface AdminProducer {
  row_type: "producer" | "invitation";
  producer_id: string | null;
  invitation_id: string | null;
  account_status: AdminProducerAccountStatus;
  name: string;
  email: string;
  is_active: boolean;
  agronomist_id: string;
  agronomist_name: string;
  agronomist_email: string;
}

export async function getPlans() {
  const { data } = await api.get<{ data: Plan[]; pagination: unknown }>("/admin/plans");
  return Array.isArray(data) ? data : data.data;
}

export async function createAdminPlan(payload: {
  name: string;
  plot_quota: number;
  timing_template_quota?: number;
  price_brl_monthly: number | string;
  is_active?: boolean;
}) {
  const { data } = await api.post<Plan>("/admin/plans", payload);
  return data;
}

export async function updateAdminPlan(
  id: string,
  payload: Partial<{
    name: string;
    plot_quota: number;
    timing_template_quota: number;
    price_brl_monthly: number | string;
    is_active: boolean;
  }>,
) {
  const { data } = await api.patch<Plan>(`/admin/plans/${id}`, payload);
  return data;
}

export async function deleteAdminPlan(id: string) {
  await api.delete(`/admin/plans/${id}`);
}

export async function getAdminAgronomists(params?: { status?: "active" | "inactive" }) {
  const status = params?.status === "inactive" ? "inactive" : "active";
  const { data } = await api.get<{ data: AdminAgronomist[] } | AdminAgronomist[]>(
    `/admin/agronomists?status=${status}`,
  );
  return Array.isArray(data) ? data : data.data;
}

export async function getAdminAgronomistDetail(id: string) {
  const { data } = await api.get<AdminAgronomistDetail>(`/admin/agronomists/${id}/detail`);
  return data;
}

export async function createAdminAgronomist(payload: {
  user: { name: string; email: string; password: string };
  plan_id: string;
}) {
  const { data } = await api.post<AdminAgronomist>("/admin/agronomists", payload);
  return data;
}

export async function updateAdminAgronomist(
  id: string,
  payload: {
    plan_id?: string;
    plan_started_at?: string;
    user?: { name?: string; email?: string; password?: string; is_active?: boolean };
  },
) {
  const { data } = await api.patch<unknown>(`/admin/agronomists/${id}`, payload);
  return data;
}

export async function deleteAdminAgronomist(id: string) {
  await api.delete(`/admin/agronomists/${id}`);
}

export async function getAdminProducers() {
  const { data } = await api.get<{ data: AdminProducer[] } | AdminProducer[]>("/admin/producers");
  return Array.isArray(data) ? data : data.data;
}

export async function patchAdminProducer(id: string, payload: { is_active: boolean }) {
  await api.patch(`/admin/producers/${id}`, payload);
}

export async function deleteAdminProducer(id: string) {
  await api.delete(`/admin/producers/${id}`);
}
