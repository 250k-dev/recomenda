import { api } from "./http/axios";
import type { AccessLevel } from "./auth-types";

/** Membro de equipe (Gestor ou Consultor). */
export interface TeamMemberRow {
  user_id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  access_level: AccessLevel;
  manager_user_id: string | null;
  manager_name: string | null;
  producer_count: number;
  assistant_count: number;
  created_at: string;
}

export interface TeamListResponse {
  managers: TeamMemberRow[];
  assistants: TeamMemberRow[];
}

export interface ShareableProducer {
  id: string;
  name: string;
}

/** Mini dashboard do membro (detalhe em /consultants/:id). */
export interface TeamMemberSummary {
  user_id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  access_level: AccessLevel;
  manager_user_id: string | null;
  manager_name: string | null;
  assistant_count: number;
  created_at: string;
  producers: ShareableProducer[];
  activity_count_30d: number;
  last_activity_at: string | null;
}

/** Uma ação do membro na carteira ("quem fez o quê"). */
export interface TeamActivityRow {
  id: string;
  actor_name?: string;
  farm_id: string | null;
  farm_name?: string | null;
  producer_id: string | null;
  entity_type: string;
  action: string;
  summary: string;
  created_at: string;
}

export async function getTeam() {
  const { data } = await api.get<TeamListResponse>("/consultants");
  return data;
}

export async function getShareableProducers() {
  const { data } = await api.get<ShareableProducer[]>("/consultants/shareable-producers");
  return data;
}

export async function getMemberProducers(userId: string) {
  const { data } = await api.get<ShareableProducer[]>(`/consultants/${userId}/producers`);
  return data;
}

export async function getConsultantSummary(userId: string) {
  const { data } = await api.get<TeamMemberSummary>(`/consultants/${userId}/summary`);
  return data;
}

export async function getConsultantActivity(userId: string) {
  const { data } = await api.get<TeamActivityRow[]>(`/consultants/${userId}/activity`);
  return data;
}

export async function grantMemberProducer(userId: string, producerId: string) {
  await api.post(`/consultants/${userId}/producers`, { producer_id: producerId });
}

export async function revokeMemberProducer(userId: string, producerId: string) {
  await api.delete(`/consultants/${userId}/producers/${producerId}`);
}

export async function removeConsultant(userId: string) {
  await api.delete(`/consultants/${userId}`);
}
