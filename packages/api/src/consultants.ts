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
  farm_count?: number;
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
  farm_count?: number;
  hectares?: number;
  created_producers_count?: number;
}

export type ActivitySeverity = "critical" | "attention" | "routine";

/** Uma ação do membro na carteira ("quem fez o quê"). */
export interface TeamActivityRow {
  id: string;
  actor_user_id?: string;
  actor_name?: string;
  actor_role?: string;
  farm_id: string | null;
  farm_name?: string | null;
  producer_id: string | null;
  producer_name?: string | null;
  entity_type: string;
  action: string;
  summary: string;
  created_at: string;
  category?: string;
  severity?: ActivitySeverity;
}

export interface GovernanceAlert {
  code: string;
  severity: "critical" | "attention";
  title: string;
  detail: string;
  user_ids: string[];
}

export interface TeamOverviewMember {
  user_id: string;
  name: string | null;
  email: string | null;
  is_active: boolean;
  access_level: AccessLevel;
  manager_user_id: string | null;
  manager_name: string | null;
  producer_count: number;
  farm_count: number;
  hectares: number;
  actions_30d: number;
  last_activity_at: string | null;
  risk_tags: string[];
  created_at: string;
}

export interface TeamOverview {
  people_count: number;
  managers_count: number;
  consultants_count: number;
  actions_30d: number;
  avg_actions_per_person: number;
  coverage: { with_consultant: number; total_producers: number };
  inactive_accounts: number;
  risk_signals_count: number;
  critical_signals_count: number;
  governance_alerts: GovernanceAlert[];
  members: TeamOverviewMember[];
}

export interface WalletActivityResponse {
  total: number;
  limit: number;
  offset: number;
  items: TeamActivityRow[];
}

export type WalletActivityQuery = {
  from?: string;
  to?: string;
  actor_user_id?: string;
  entity_type?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function getTeam() {
  const { data } = await api.get<TeamListResponse>("/consultants");
  return data;
}

export async function getTeamOverview() {
  const { data } = await api.get<TeamOverview>("/consultants/overview");
  return data;
}

export async function getWalletActivity(params?: WalletActivityQuery) {
  const { data } = await api.get<WalletActivityResponse>("/consultants/activity", {
    params,
  });
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
