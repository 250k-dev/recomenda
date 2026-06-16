import { api } from "@/lib/http/axios";
import type { PaginatedResponse } from "@/lib/api/types";

export interface Producer {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
}

export interface CreatedProducer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export type AdminProducerAccountStatus =
  | "ATIVO"
  | "INATIVO"
  | "CONVITE_ENVIADO"
  | "CONVITE_EXPIRADO";

export interface AgronomistProducerListRow {
  row_type: "producer" | "invitation";
  producer_id: string | null;
  invitation_id: string | null;
  name: string;
  email: string;
  is_active: boolean;
  account_status: AdminProducerAccountStatus;
  total_hectares?: number;
  farms_count?: number | null;
  plots_count?: number | null;
  active_seasons_count?: number | null;
  attention_late_count?: number;
  attention_today_count?: number;
}

export function activeAgronomistProducerAccounts(
  rows: AgronomistProducerListRow[],
): Array<AgronomistProducerListRow & { producer_id: string }> {
  return rows.filter(
    (p): p is AgronomistProducerListRow & { producer_id: string } =>
      p.row_type === "producer" && p.producer_id != null && p.is_active,
  );
}

export interface ProducerFarm {
  id: string;
  name: string;
  location?: string | null;
  plots: { id: string; name: string; area_hectares: string }[];
  seasons: { id: string; crop: string; variety: string; status: string; plot_name: string }[];
}

export interface ProducerStock {
  id: string;
  local_product_id: string;
  quantity: number;
  product_name?: string;
  dose_unit?: string;
}

export interface InvitationPreview {
  id: string;
  email?: string;
  farm_ids: string[];
  status: string;
  expires_at: string;
  agronomist_id: string;
}

export interface Invitation {
  id: string;
  link: string;
  token: string;
}

export async function getProducers() {
  const { data } = await api.get<PaginatedResponse<AgronomistProducerListRow>>("/producers");
  return data;
}

export async function getProducer(id: string) {
  const { data } = await api.get<Producer>(`/producers/${id}`);
  return data;
}

export async function createProducer(payload: { name: string; email?: string; phone?: string }) {
  const { data } = await api.post<CreatedProducer>("/producers", payload);
  return data;
}

export async function updateProducer(id: string, payload: { name?: string; email?: string; phone?: string }) {
  const { data } = await api.patch<Producer>(`/producers/${id}`, payload);
  return data;
}

export async function setProducerActive(id: string, isActive: boolean) {
  await api.patch(`/producers/${id}`, { is_active: isActive });
}

export async function deleteProducer(id: string) {
  await api.delete(`/producers/${id}`);
}

export async function getProducerFarms(producerId: string) {
  const { data } = await api.get<ProducerFarm[]>(`/producers/${producerId}/farms`);
  return data;
}

export async function getProducerStock(producerId: string) {
  const { data } = await api.get<ProducerStock[]>(`/producers/${producerId}/stock`);
  return data;
}

export async function removeFarmAccess(producerId: string, farmId: string) {
  await api.delete(`/producers/${producerId}/farms/${farmId}`);
}

export async function getInvitationByToken(token: string) {
  const { data } = await api.get<InvitationPreview>(`/invitations/by-token/${token}`);
  return data;
}

export async function acceptInvitation(token: string, payload: { name: string; password: string }) {
  const { data } = await api.post<{ accepted: boolean; producer_id: string }>(
    `/invitations/by-token/${token}/accept`,
    payload,
  );
  return data;
}

export async function createInvitation(payload: { email?: string; farm_ids: string[] }) {
  const { data } = await api.post<Invitation>("/invitations", payload);
  return data;
}

export async function revokeInvitation(id: string) {
  const { data } = await api.post(`/invitations/${id}/revoke`);
  return data;
}
