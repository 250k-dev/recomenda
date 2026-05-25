import { api } from "@/lib/http/axios";
import type { LoginResponse } from "@/types/auth";
import type { PaginatedResponse, AgronomistMePlanResponse } from "@/lib/api/types";

export interface Farm {
  id: string;
  name: string;
  location?: string;
}

/** Resposta de `GET /producers/:id` (conta de produtor). */
export interface Producer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export type AdminProducerAccountStatus =
  | "ATIVO"
  | "INATIVO"
  | "CONVITE_ENVIADO"
  | "CONVITE_EXPIRADO";

/** Linha da listagem `GET /producers` (agrônomo): contas + convites pendentes/expirados. */
export interface AgronomistProducerListRow {
  row_type: "producer" | "invitation";
  producer_id: string | null;
  invitation_id: string | null;
  name: string;
  email: string;
  is_active: boolean;
  account_status: AdminProducerAccountStatus;
  total_hectares?: number;
}

/** Produtores com conta ativa (ex.: selects de safra e concessão de fazenda). */
export function activeAgronomistProducerAccounts(
  rows: AgronomistProducerListRow[],
): Array<AgronomistProducerListRow & { producer_id: string }> {
  return rows.filter(
    (p): p is AgronomistProducerListRow & { producer_id: string } =>
      p.row_type === "producer" && p.producer_id != null && p.is_active,
  );
}

export interface Season {
  id: string;
  crop: string;
  status: string;
  plot_name: string;
}

export interface ProducerFarm {
  id: string;
  name: string;
  location?: string | null;
  plots: { id: string; name: string; area_hectares: string }[];
  seasons: { id: string; crop: string; variety: string; status: string; plot_name: string }[];
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  dose_unit?: string;
  price_brl?: string;
  label_url?: string;
}

/** Produto do catálogo global (referência administrativa). */
export interface GlobalProduct extends Product {
  category: string;
  dose_unit: string;
  default_label_url?: string | null;
  equivalence_group?: string | null;
  is_active?: boolean;
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

export async function getFarms() {
  const { data } = await api.get<PaginatedResponse<Farm>>("/farms");
  return data;
}

export async function getProducers() {
  const { data } = await api.get<PaginatedResponse<AgronomistProducerListRow>>("/producers");
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

export async function getLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/local");
  return data;
}

export type PlatformCatalogEntry = {
  entry_type: "GLOBAL" | "OWN_CUSTOM" | "PEER_CUSTOM";
  local_product_id: string | null;
  global_product_id: string | null;
  peer_local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  label_url?: string | null;
  price_brl?: string | null;
  owner_name?: string | null;
  can_edit: boolean;
  can_deactivate: boolean;
  can_clone_to_my_catalog: boolean;
};

export async function getPlatformCatalog() {
  const { data } = await api.get<{ data: PlatformCatalogEntry[] }>("/catalog/platform");
  return data;
}

export type AdminPlatformActiveEntry = {
  entry_type: "GLOBAL" | "CUSTOM";
  global_product_id: string | null;
  local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  label_url?: string | null;
  price_brl?: string | null;
  equivalence_group?: string | null;
  default_label_url?: string | null;
  is_active?: boolean;
  owner_agronomist_id?: string | null;
  owner_name?: string | null;
};

export async function getAdminPlatformActiveCatalog() {
  const { data } = await api.get<{ data: AdminPlatformActiveEntry[] }>("/catalog/admin/platform-active");
  return data;
}

export type AdminDeactivatedCatalogEntry = {
  entry_type: "GLOBAL_INACTIVE" | "CUSTOM_INACTIVE";
  global_product_id: string | null;
  local_product_id: string | null;
  name: string;
  category: string;
  dose_unit: string;
  label_url?: string | null;
  price_brl?: string | null;
  agronomist_name?: string | null;
};

export async function getAdminDeactivatedCatalog() {
  const { data } = await api.get<{ data: AdminDeactivatedCatalogEntry[] }>("/catalog/admin/deactivated");
  return data;
}

export async function clonePeerLocalProduct(sourceLocalId: string) {
  const { data } = await api.post<Product>(`/catalog/local/from-peer/${encodeURIComponent(sourceLocalId)}`);
  return data;
}

export async function deleteLocalProduct(id: string) {
  await api.delete(`/catalog/local/${encodeURIComponent(id)}`);
}

export async function getInactiveLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/local/inactive");
  return data;
}

export async function getAllInactiveLocalCatalog() {
  const { data } = await api.get<PaginatedResponse<Product & { agronomist_name?: string }>>("/catalog/local/inactive/all");
  return data;
}

export async function getAllLocalProducts() {
  const { data } = await api.get<PaginatedResponse<Product>>("/catalog/admin/local-all");
  return data;
}

export async function getGlobalCatalog(): Promise<PaginatedResponse<GlobalProduct>> {
  const { data } = await api.get<GlobalProduct[] | PaginatedResponse<GlobalProduct>>("/catalog/global");
  if (Array.isArray(data)) {
    return {
      data,
      pagination: {
        page: 1,
        page_size: data.length,
        total: data.length,
        total_pages: 1,
      },
    };
  }
  return data;
}

export async function createGlobalProduct(payload: {
  name: string;
  category: string;
  dose_unit: string;
  default_label_url?: string | null;
  equivalence_group?: string | null;
  is_active?: boolean;
}) {
  const { data } = await api.post<GlobalProduct>("/catalog/global", payload);
  return data;
}

export async function updateGlobalProduct(
  id: string,
  payload: Partial<{
    name: string;
    category: string;
    dose_unit: string;
    default_label_url: string | null;
    equivalence_group: string | null;
    is_active: boolean;
  }>,
) {
  const { data } = await api.patch<GlobalProduct>(`/catalog/global/${id}`, payload);
  return data;
}

export async function deleteGlobalProduct(id: string) {
  await api.delete(`/catalog/global/${id}`);
}

export type GlobalCatalogImportResult = {
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export async function importGlobalCatalogFile(file: File): Promise<GlobalCatalogImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<GlobalCatalogImportResult>("/catalog/admin/global/import", formData);
  return data;
}

export async function createLocalProduct(payload: { name: string; category?: string; dose_unit?: string; label_url?: string }) {
  const { data } = await api.post<Product>("/catalog/local", payload);
  return data;
}

export async function cloneGlobalProduct(globalId: string) {
  const { data } = await api.post<Product>(`/catalog/local/from-global/${globalId}`);
  return data;
}

export async function updateLocalProduct(id: string, payload: { name?: string; category?: string; dose_unit?: string; price_brl?: string; price_usd?: string; label_url?: string; is_active?: boolean }) {
  const { data } = await api.patch<Product>(`/catalog/local/${id}`, payload);
  return data;
}

export async function getSeasons() {
  const { data } = await api.get<PaginatedResponse<Season>>("/seasons");
  return data;
}

export async function getArchivedSeasons() {
  const { data } = await api.get<Season[]>("/seasons/archived");
  return data;
}

export async function archiveSeason(id: string) {
  const { data } = await api.post(`/seasons/${id}/archive`);
  return data;
}

export async function hardDeleteSeason(id: string) {
  await api.delete(`/seasons/${id}/hard`);
}

export interface SeasonDetail extends Season {
  producer_id: string;
  agronomist_id: string;
  plot_id: string;
  variety?: string;
  planting_date?: string;
  desiccation_date?: string;
}

export async function getSeason(id: string) {
  const { data } = await api.get<SeasonDetail>(`/seasons/${id}`);
  return data;
}

export async function getTimeline(seasonId: string) {
  const { data } = await api.get<unknown[] | { data: unknown[] }>(`/seasons/${seasonId}/timeline`);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as { data: unknown[] }).data)) {
    return (data as { data: unknown[] }).data;
  }
  return [];
}

export async function createSeason(payload: Record<string, unknown>) {
  const { data } = await api.post("/seasons", payload);
  return data;
}

export async function publishSeason(seasonId: string, initialStock: Array<{ local_product_id: string; quantity: number }> = []) {
  const { data } = await api.post(`/seasons/${seasonId}/publish`, { initial_stock: initialStock });
  return data;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "INVITATION" | "RECOMMENDATION_DUE" | "RECOMMENDATION_LATE" | "PRODUCT_SUBSTITUTED" | "SEASON_PUBLISHED" | "HARVEST_REGISTERED";
  payload: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

export async function getNotifications() {
  const { data } = await api.get<{ data: Notification[] }>("/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}

export interface TimingStage {
  id: string;
  timing_template_id: string;
  order_index: number;
  name: string;
  trigger_type: string;
  window_start_days: number;
  window_end_days: number;
  default_mix_template_id?: string | null;
  notes?: string | null;
}

export interface TimingTemplate {
  id: string;
  name: string;
  crop: string;
  is_archived: boolean;
  stages?: TimingStage[];
}

export async function getTimingTemplates() {
  const { data } = await api.get<TimingTemplate[]>("/timing_templates");
  return data;
}

export async function getTimingTemplate(id: string) {
  const { data } = await api.get<TimingTemplate & { stages: TimingStage[] }>(
    `/timing_templates/${id}`,
  );
  return data;
}

export async function createTimingTemplate(payload: { name: string; crop: string }) {
  const { data } = await api.post<TimingTemplate>("/timing_templates", payload);
  return data;
}

export async function updateTimingTemplate(id: string, payload: Partial<TimingTemplate>) {
  const { data } = await api.patch<TimingTemplate>(`/timing_templates/${id}`, payload);
  return data;
}

export async function deleteTimingTemplate(id: string) {
  await api.delete(`/timing_templates/${id}`);
}

export async function getArchivedTimingTemplates() {
  const { data } = await api.get<TimingTemplate[] | { data: TimingTemplate[] } | null>("/timing_templates/archived");
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.data)) return data.data;
  return [];
}

export async function hardDeleteTimingTemplate(id: string) {
  await api.delete(`/timing_templates/${id}/hard`);
}

export async function createTimingStage(
  templateId: string,
  payload: Omit<TimingStage, "id" | "timing_template_id">,
) {
  const { data } = await api.post<TimingStage>(`/timing_templates/${templateId}/stages`, payload);
  return data;
}

export async function updateTimingStage(id: string, payload: Partial<TimingStage>) {
  const { data } = await api.patch<TimingStage>(`/timing_stages/${id}`, payload);
  return data;
}

export async function deleteTimingStage(id: string) {
  await api.delete(`/timing_stages/${id}`);
}

export async function reorderTimingStages(templateId: string, stageIdsInOrder: string[]) {
  await api.post(`/timing_templates/${templateId}/stages/reorder`, {
    stage_ids_in_order: stageIdsInOrder,
  });
}

export interface MixTemplateItem {
  id: string;
  mix_template_id: string;
  local_product_id: string;
  dose_per_hectare: number;
  product_name?: string;
  dose_unit?: string;
}

export interface MixTemplate {
  id: string;
  name: string;
  crop: string;
  is_archived: boolean;
  items?: MixTemplateItem[];
}

export async function getMixTemplates() {
  const { data } = await api.get<MixTemplate[]>("/mix_templates");
  return data;
}

export async function getMixTemplate(id: string) {
  const { data } = await api.get<MixTemplate & { items: MixTemplateItem[] }>(
    `/mix_templates/${id}`,
  );
  return data;
}

export async function createMixTemplate(payload: { name: string; crop: string }) {
  const { data } = await api.post<MixTemplate>("/mix_templates", payload);
  return data;
}

export async function updateMixTemplate(id: string, payload: Partial<MixTemplate>) {
  const { data } = await api.patch<MixTemplate>(`/mix_templates/${id}`, payload);
  return data;
}

export async function deleteMixTemplate(id: string) {
  await api.delete(`/mix_templates/${id}`);
}

export async function getArchivedMixTemplates() {
  const { data } = await api.get<MixTemplate[] | { data: MixTemplate[] } | null>("/mix_templates/archived");
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.data)) return data.data;
  return [];
}

export async function hardDeleteMixTemplate(id: string) {
  await api.delete(`/mix_templates/${id}/hard`);
}

export async function createMixTemplateItem(
  templateId: string,
  payload: { local_product_id: string; dose_per_hectare: number; dose_unit?: string },
) {
  const { data } = await api.post<MixTemplateItem>(`/mix_templates/${templateId}/items`, payload);
  return data;
}

export async function updateMixTemplateItem(
  id: string,
  payload: { dose_per_hectare?: number; dose_unit?: string },
) {
  const { data } = await api.patch<MixTemplateItem>(`/mix_template_items/${id}`, payload);
  return data;
}

export async function deleteMixTemplateItem(id: string) {
  await api.delete(`/mix_template_items/${id}`);
}

export interface InvitationPreview {
  id: string;
  email?: string;
  farm_ids: string[];
  status: string;
  expires_at: string;
  agronomist_id: string;
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

export interface Plan {
  id: string;
  name: string;
  plot_quota: number;
  price_brl_monthly: string;
  is_active: boolean;
}

export async function getPlans() {
  const { data } = await api.get<{ data: Plan[]; pagination: unknown }>("/admin/plans");
  return Array.isArray(data) ? data : data.data;
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

export async function getAdminAgronomistDetail(id: string) {
  const { data } = await api.get<AdminAgronomistDetail>(`/admin/agronomists/${id}/detail`);
  return data;
}

export async function getAdminAgronomists(params?: { status?: "active" | "inactive" }) {
  const status = params?.status === "inactive" ? "inactive" : "active";
  const { data } = await api.get<{ data: AdminAgronomist[] } | AdminAgronomist[]>(
    `/admin/agronomists?status=${status}`,
  );
  return Array.isArray(data) ? data : data.data;
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

export async function createAdminPlan(payload: {
  name: string;
  plot_quota: number;
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

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  area_hectares: number;
}

export async function getFarmPlots(farmId: string) {
  const { data } = await api.get<Plot[]>(`/farms/${farmId}/plots`);
  return data;
}

export async function createPlot(farmId: string, payload: { name: string; area_hectares: number }) {
  const { data } = await api.post<Plot>(`/farms/${farmId}/plots`, payload);
  return data;
}

export async function deletePlot(id: string) {
  await api.delete(`/plots/${id}`);
}

export interface FarmAccess {
  producer_id: string;
  farm_id: string;
  granted_at: string;
}

export async function getFarmAccess(farmId: string) {
  const { data } = await api.get<FarmAccess[]>(`/farms/${farmId}/access`);
  return data;
}

export async function grantFarmAccess(farmId: string, producerId: string) {
  const { data } = await api.post<FarmAccess>(`/farms/${farmId}/access`, { producer_id: producerId });
  return data;
}

export async function revokeFarmAccess(farmId: string, producerId: string) {
  await api.delete(`/farms/${farmId}/access/${producerId}`);
}

export async function getFarm(id: string) {
  const { data } = await api.get<Farm>(`/farms/${id}`);
  return data;
}

export async function updateFarm(id: string, payload: { name?: string; location?: string }) {
  const { data } = await api.patch<Farm>(`/farms/${id}`, payload);
  return data;
}

export interface FarmSeason {
  id: string;
  farm_id: string;
  plot_id: string;
  plot_name: string;
  plot_area_hectares: number | null;
  crop: string;
  variety?: string | null;
  status: string;
  planting_date?: string | null;
  cycle_days?: number | null;
}

export async function getFarmSeasons(farmId: string) {
  const { data } = await api.get<{ data: FarmSeason[] } | FarmSeason[]>(`/farms/${farmId}/seasons`);
  return Array.isArray(data) ? data : data.data;
}

export async function createFarm(payload: { name: string; location?: string; agronomist_id?: string }) {
  const { data } = await api.post<Farm>("/farms", payload);
  return data;
}

export interface ShoppingListItem {
  local_product_id: string;
  product_name: string;
  total_quantity: number;
  dose_unit: string;
  current_stock?: number;
  quantity_to_buy?: number;
}

export async function getSeasonShoppingList(seasonId: string) {
  const { data } = await api.get<ShoppingListItem[]>(`/seasons/${seasonId}/shopping_list`);
  return data;
}

export interface ProducerStock {
  id: string;
  local_product_id: string;
  quantity: number;
  product_name?: string;
  dose_unit?: string;
}

export async function getProducerStock(producerId: string) {
  const { data } = await api.get<ProducerStock[]>(`/producers/${producerId}/stock`);
  return data;
}

export async function getProducer(id: string) {
  const { data } = await api.get<Producer>(`/producers/${id}`);
  return data;
}

export interface CreatedProducer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export async function createProducer(payload: { name: string; email: string; phone?: string }) {
  const { data } = await api.post<CreatedProducer>("/producers", payload);
  return data;
}

export interface PurchaseListItemInput {
  local_product_id: string;
  stage: string;
  dose_per_hectare: number;
  dose_unit: string;
  n_applications?: number;
  current_stock?: number;
  supplier?: string | null;
  area_factor?: number;
  price_usd?: number | null;
  price_brl_fixed?: number | null;
  cost_per_ha_mode?: "DOSE_PRICE" | "TOTAL_OVER_AREA";
  deduct_stock?: boolean;
  calc_rule?: "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;
}

export interface PurchaseListPlotInput {
  plot_id: string;
  planting_date?: string | null;
  desiccation_date?: string | null;
  cycle_days?: number | null;
}

export interface PurchaseListInput {
  producer_id: string;
  crop: string;
  name: string;
  variety?: string;
  fx_rate_usd_brl?: number | null;
  grain_price_brl?: number | null;
  season_id?: string | null;
  plots: PurchaseListPlotInput[];
  items: PurchaseListItemInput[];
}

export interface CostPlanCategoryBreakdown {
  category: string;
  total_brl: number;
  share_pct: number;
  sacks_per_ha: number;
}

export interface CostPlanSummary {
  grand_total_brl: number;
  cost_per_ha_brl: number;
  total_sacks: number;
  sacks_per_ha: number;
  category_breakdown: CostPlanCategoryBreakdown[];
}

export interface PurchaseListDetail {
  id: string;
  producer_id: string;
  season_id: string | null;
  crop: string;
  name: string;
  variety: string | null;
  fx_rate_usd_brl: number | null;
  grain_price_brl: number | null;
  created_at: string;
  updated_at?: string;
  total_hectares: number;
  plots: Array<{
    id: string;
    plot_id: string;
    plot_name: string;
    area_hectares: number;
    planting_date: string | null;
    desiccation_date: string | null;
    cycle_days: number | null;
  }>;
  items: Array<{
    id: string;
    local_product_id: string;
    product_name: string;
    category: string;
    stage: string;
    dose_per_hectare: number;
    dose_unit: string;
    n_applications: number;
    current_stock: number;
    required_quantity: number;
    quantity_to_buy: number;
    supplier: string | null;
    area_factor: number;
    price_usd: number | null;
    price_brl_fixed: number | null;
    cost_per_ha_mode: "DOSE_PRICE" | "TOTAL_OVER_AREA";
    deduct_stock: boolean;
    calc_rule: "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;
    quantity_final: number;
    unit_price_brl: number;
    total_brl: number;
    cost_per_ha_brl: number;
  }>;
  cost_summary?: CostPlanSummary;
}

export async function createPurchaseList(payload: PurchaseListInput) {
  const { data } = await api.post<PurchaseListDetail>("/purchase-lists", payload);
  return data;
}

export async function getPurchaseList(id: string) {
  const { data } = await api.get<PurchaseListDetail>(`/purchase-lists/${id}`);
  return data;
}

export async function getProducerPurchaseLists(producerId: string) {
  const { data } = await api.get<PurchaseListDetail[]>(`/purchase-lists`, {
    params: { producer_id: producerId },
  });
  return data;
}

export async function getFarmPurchaseLists(farmId: string) {
  const { data } = await api.get<PurchaseListDetail[]>(`/farms/${farmId}/purchase-lists`);
  return data;
}

export async function getPurchaseListBySeason(seasonId: string) {
  const { data } = await api.get<PurchaseListDetail | null>(
    `/purchase-lists/by-season/${seasonId}`,
  );
  return data;
}

export async function updatePurchaseList(id: string, payload: Partial<PurchaseListInput>) {
  const { data } = await api.put<PurchaseListDetail>(`/purchase-lists/${id}`, payload);
  return data;
}

export async function duplicatePurchaseList(id: string) {
  const { data } = await api.post<PurchaseListDetail>(`/purchase-lists/${id}/duplicate`);
  return data;
}

export async function getProducerFarms(producerId: string) {
  const { data } = await api.get<ProducerFarm[]>(`/producers/${producerId}/farms`);
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

export async function removeFarmAccess(producerId: string, farmId: string) {
  await api.delete(`/producers/${producerId}/farms/${farmId}`);
}

export interface ReportSummary {
  total_seasons: number;
  harvested_seasons: number;
  in_progress_seasons: number;
  compliance_rate_pct: number | null;
}

export interface ReportPerSeason {
  season_id: string;
  crop: string;
  variety?: string;
  plot_area_ha: number;
  cost_per_ha_brl: number;
  bags_per_ha: number | null;
  sale_price_per_bag_brl: number | null;
}

export interface ComparativeReport {
  summary: ReportSummary;
  per_season: ReportPerSeason[];
}

export async function getComparativeReport() {
  const { data } = await api.get<ComparativeReport>("/agronomists/me/reports");
  return data;
}

export interface Invitation {
  id: string;
  link: string;
  token: string;
}

export async function createInvitation(payload: { email?: string; farm_ids: string[] }) {
  const { data } = await api.post<Invitation>("/invitations", payload);
  return data;
}

export async function revokeInvitation(id: string) {
  const { data } = await api.post(`/invitations/${id}/revoke`);
  return data;
}

// ── Recommendations ────────────────────────────────────────────────────────

export interface RecommendationItem {
  id: string;
  recommendation_id: string;
  local_product_id: string;
  product_name: string;
  dose_per_hectare: number;
  total_quantity: number;
  dose_unit: string;
  is_substitution: boolean;
}

export interface Recommendation {
  id: string;
  season_id: string;
  order_index: number;
  name: string;
  status: "PENDING" | "APPLIED_ON_TIME" | "APPLIED_LATE" | "SKIPPED";
  predicted_date_current: string | null;
  predicted_date_original: string | null;
  executed_date: string | null;
  notes: string | null;
  window_start_days: number;
  window_end_days: number;
  items: RecommendationItem[];
}

export async function patchRecommendation(
  id: string,
  payload: {
    name?: string;
    predicted_date_current?: string | null;
    window_start_days?: number;
    window_end_days?: number;
    notes?: string | null;
  },
) {
  const { data } = await api.patch(`/recommendations/${id}`, payload);
  return data;
}

export async function applyRecommendation(
  id: string,
  payload: { executed_date: string; notes?: string },
) {
  const { data } = await api.post(`/recommendations/${id}/apply`, payload);
  return data;
}

export async function skipRecommendation(id: string, notes?: string) {
  const { data } = await api.post(`/recommendations/${id}/skip`, { notes: notes ?? "" });
  return data;
}

export async function undoRecommendation(id: string) {
  const { data } = await api.post(`/recommendations/${id}/undo`);
  return data;
}

export async function createRecommendationItem(payload: {
  recommendation_id: string;
  local_product_id: string;
  dose_per_hectare: number;
  dose_unit?: string;
}) {
  const { data } = await api.post(`/recommendation_items`, payload);
  return data;
}

export async function updateRecommendationItem(
  id: string,
  payload: { dose_per_hectare?: number; dose_unit?: string },
) {
  const { data } = await api.patch(`/recommendation_items/${id}`, payload);
  return data;
}

export async function deleteRecommendationItem(id: string) {
  const { data } = await api.delete(`/recommendation_items/${id}`);
  return data;
}
