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

export async function getConsultants() {
  const { data } = await api.get<ConsultantRow[]>("/consultants");
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
