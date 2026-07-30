import { api } from "./http/axios";
import type { AccessLevel } from "./auth-types";

export interface FarmTeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  access_level: AccessLevel;
  farm_id: string | null;
  producer_id: string;
  producer_name: string;
  created_at: string;
}

export async function getFarmTeamAll() {
  const { data } = await api.get<{ data: FarmTeamMember[] } | FarmTeamMember[]>("/farm-team");
  return Array.isArray(data) ? data : data.data;
}

export async function getFarmTeamProducers() {
  const { data } = await api.get<
    { data: Array<{ id: string; name: string }> } | Array<{ id: string; name: string }>
  >("/farm-team/producers");
  return Array.isArray(data) ? data : data.data;
}

export async function getFarmTeam(producerId: string) {
  const { data } = await api.get<{ data: FarmTeamMember[] } | FarmTeamMember[]>(
    `/farm-team/producer/${producerId}`,
  );
  return Array.isArray(data) ? data : data.data;
}

export async function createFarmTeamMember(payload: {
  producer_id?: string;
  producer_ids?: string[];
  name?: string;
  email: string;
  password?: string;
  access_level: AccessLevel;
  farm_id?: string | null;
}) {
  const { data } = await api.post<{
    user_id: string;
    email: string;
    access_level: AccessLevel;
    memberships: Array<{ id: string; producer_id: string }>;
    temporary_password: string | null;
  }>("/farm-team", payload);
  return data;
}

export async function deleteFarmTeamMember(id: string) {
  await api.delete(`/farm-team/${id}`);
}
