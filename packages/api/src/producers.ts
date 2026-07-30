import { api } from "./http/axios";
import type { PaginatedResponse } from "./types";

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
  /** Quem cadastrou o produtor (null = agrônomo / legado). Usado no gate de exclusão do Gestor. */
  created_by_user_id?: string | null;
  total_hectares?: number;
  farms_count?: number | null;
  plots_count?: number | null;
  active_cycles_count?: number | null;
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
  category?: string | null;
  /** Preço unitário deste produtor (R$) — não vem do catálogo global. */
  price_brl?: number | null;
}

export type InvitationKind = "PRODUCER" | "CONSULTANT" | "FARM_TEAM";
export type InvitationAccessLevel =
  | "MANAGER"
  | "CONSULTANT"
  | "FARM_MANAGER"
  | "FARM_OPERATOR";

export interface InvitationPreview {
  id: string;
  email?: string;
  farm_ids: string[];
  status: string;
  expires_at: string;
  agronomist_id: string;
  kind?: InvitationKind;
  access_level?: InvitationAccessLevel;
  /** Conta com este e-mail já existe (fluxo "juntar-se à equipe"). */
  account_exists?: boolean;
  /** true = definir senha nova; false = confirmar senha atual. */
  needs_password_setup?: boolean;
  agronomist_name?: string | null;
}

export interface Invitation {
  id: string;
  link: string;
  token: string;
  /** false quando o convite foi criado sem e-mail — só resta copiar o link. */
  email_sent: boolean;
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

/** Envia/reenvia convite para o produtor definir senha e acessar o painel web. */
export async function inviteProducerAccess(producerId: string) {
  const { data } = await api.post<{
    id: string;
    token: string;
    email_sent: boolean;
    resent: boolean;
  }>(`/producers/${producerId}/invite-access`);
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

export async function adjustProducerStock(
  producerId: string,
  payload: {
    local_product_id: string;
    new_quantity: number;
    notes?: string;
    price_brl?: number | null;
  },
) {
  const { data } = await api.post(`/producers/${producerId}/stock/adjust`, payload);
  return data;
}

export async function removeFarmAccess(producerId: string, farmId: string) {
  await api.delete(`/producers/${producerId}/farms/${farmId}`);
}

export async function getInvitationByToken(token: string) {
  const { data } = await api.get<InvitationPreview>(`/invitations/by-token/${token}`);
  return data;
}

export async function acceptInvitation(
  token: string,
  payload: { name?: string; password?: string },
) {
  const { data } = await api.post<{
    accepted: boolean;
    producer_id: string;
    existing_account: boolean;
    is_temporary: boolean;
  }>(`/invitations/by-token/${token}/accept`, payload);
  return data;
}

export async function createInvitation(payload: {
  email?: string;
  farm_ids?: string[];
  kind?: InvitationKind;
  /** CONSULTANT: Gestor/Consultor · FARM_TEAM: Gerente/Operador. */
  access_level?: InvitationAccessLevel;
  /** Só para CONSULTANT criado pelo agrônomo: vínculo sob um gestor (null = direto). */
  manager_user_id?: string | null;
  /** Produtores liberados assim que o convite de equipe for aceito. */
  producer_ids?: string[];
}) {
  const { data } = await api.post<Invitation>("/invitations", payload);
  return data;
}

export async function revokeInvitation(id: string) {
  const { data } = await api.post(`/invitations/${id}/revoke`);
  return data;
}

/** Convite como aparece na listagem (o de equipe alimenta a tela de Equipe). */
export interface InvitationRow {
  id: string;
  email?: string | null;
  token: string;
  kind: InvitationKind;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  access_level?: InvitationAccessLevel | null;
  manager_user_id?: string | null;
  farm_ids: string[];
  expires_at: string;
  created_at: string;
}

export async function getInvitations(kind?: InvitationKind) {
  const { data } = await api.get<{ data: InvitationRow[] }>("/invitations", {
    params: kind ? { kind } : undefined,
  });
  return data.data;
}

export async function resendInvitation(id: string) {
  const { data } = await api.post<{ ok: true; email_sent: boolean }>(
    `/invitations/${id}/resend`,
  );
  return data;
}

/** Exclui de vez — só funciona em convite não aceito. */
export async function deleteInvitation(id: string) {
  const { data } = await api.delete<{ ok: true }>(`/invitations/${id}`);
  return data;
}
