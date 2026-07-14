import { api } from "@/lib/http/axios";

export interface ConsultantRow {
  user_id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  farm_count: number;
  created_at: string;
}

export interface ConsultantFarm {
  id: string;
  name: string;
  location: string | null;
}

/** Mini dashboard do consultor (card clicável em /consultants). */
export interface ConsultantSummary {
  user_id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  farms: ConsultantFarm[];
  producers: Array<{ id: string; name: string }>;
  activity_count_30d: number;
  last_activity_at: string | null;
}

/** Uma ação do consultor na carteira ("quem fez o quê"). */
export interface ConsultantActivityRow {
  id: string;
  actor_name: string;
  farm_id: string | null;
  farm_name: string | null;
  producer_id: string | null;
  entity_type: string;
  action: string;
  summary: string;
  created_at: string;
}

export async function getConsultants() {
  const { data } = await api.get<ConsultantRow[]>("/consultants");
  return data;
}

export async function getConsultantSummary(userId: string) {
  const { data } = await api.get<ConsultantSummary>(`/consultants/${userId}/summary`);
  return data;
}

export async function getConsultantActivity(userId: string) {
  const { data } = await api.get<ConsultantActivityRow[]>(
    `/consultants/${userId}/activity`,
  );
  return data;
}

export async function getConsultantFarms(userId: string) {
  const { data } = await api.get<ConsultantFarm[]>(`/consultants/${userId}/farms`);
  return data;
}

export async function grantConsultantFarm(userId: string, farmId: string) {
  await api.post(`/consultants/${userId}/farms`, { farm_id: farmId });
}

export async function revokeConsultantFarm(userId: string, farmId: string) {
  await api.delete(`/consultants/${userId}/farms/${farmId}`);
}

export async function removeConsultant(userId: string) {
  await api.delete(`/consultants/${userId}`);
}
