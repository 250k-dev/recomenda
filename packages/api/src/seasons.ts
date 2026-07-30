import { api } from "./http/axios";
import type { PaginatedResponse } from "./types";

export interface Season {
  id: string;
  crop: string;
  status: string;
  plot_name: string;
}

export interface SeasonDetail extends Season {
  producer_id: string;
  agronomist_id: string;
  plot_id: string;
  variety?: string;
  planting_date?: string;
  desiccation_date?: string;
  /** Ordem customizada das formulações na calda (null = padrão oficial). */
  mix_formulation_order?: string[] | null;
}

export interface ShoppingListItem {
  local_product_id: string;
  product_name: string;
  total_quantity: number;
  dose_unit: string;
  current_stock?: number;
  quantity_to_buy?: number;
}

export interface RecommendationItem {
  id: string;
  recommendation_id: string;
  local_product_id: string;
  product_name: string;
  dose_per_hectare: number;
  total_quantity: number;
  dose_unit: string;
  is_substitution: boolean;
  /** Ordem efetiva (formulacao / override). */
  mix_order?: number;
  /** Override por item (legado); null = usa formulacao da safra. */
  mix_order_override?: number | null;
  equivalence_group?: string | null;
  formulation_key?: string | null;
}

export interface Recommendation {
  id: string;
  season_id: string;
  order_index: number;
  name: string;
  trigger_type?: string;
  status: "PENDING" | "APPLIED_ON_TIME" | "APPLIED_LATE" | "SKIPPED";
  predicted_date_current: string | null;
  predicted_date_original: string | null;
  executed_date: string | null;
  notes: string | null;
  window_start_days: number;
  window_end_days: number;
  items: RecommendationItem[];
}

export async function getSeasons() {
  const { data } = await api.get<PaginatedResponse<Season>>("/seasons");
  return data;
}

export async function getArchivedSeasons() {
  const { data } = await api.get<Season[]>("/seasons/archived");
  return data;
}

export async function getSeason(id: string) {
  const { data } = await api.get<SeasonDetail>(`/seasons/${id}`);
  return data;
}

export async function createSeason(payload: Record<string, unknown>) {
  const { data } = await api.post("/seasons", payload);
  return data;
}

export async function updateSeason(
  id: string,
  payload: {
    planting_date?: string | null;
    desiccation_date?: string | null;
    mix_formulation_order?: string[] | null;
  },
) {
  const { data } = await api.patch<SeasonDetail>(`/seasons/${id}`, payload);
  return data;
}

export async function archiveSeason(id: string) {
  const { data } = await api.post(`/seasons/${id}/archive`);
  return data;
}

export async function hardDeleteSeason(id: string) {
  await api.delete(`/seasons/${id}/hard`);
}

export async function publishSeason(seasonId: string, initialStock: Array<{ local_product_id: string; quantity: number }> = []) {
  const { data } = await api.post(`/seasons/${seasonId}/publish`, { initial_stock: initialStock });
  return data;
}

export async function getTimeline(seasonId: string) {
  const { data } = await api.get<unknown[] | { data: unknown[] }>(`/seasons/${seasonId}/timeline`);
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown[] }).data)) {
    return (data as { data: unknown[] }).data;
  }
  return [];
}

export async function getSeasonShoppingList(seasonId: string) {
  const { data } = await api.get<ShoppingListItem[]>(`/seasons/${seasonId}/shopping_list`);
  return data;
}

export async function createRecommendation(
  seasonId: string,
  payload: {
    name: string;
    predicted_date_current?: string | null;
    trigger_type?: string;
    notes?: string | null;
  },
) {
  const { data } = await api.post(`/seasons/${seasonId}/recommendations`, payload);
  return data;
}

export async function reorderRecommendations(
  seasonId: string,
  recommendationIdsInOrder: string[],
) {
  await api.post(`/seasons/${seasonId}/recommendations/reorder`, {
    recommendation_ids_in_order: recommendationIdsInOrder,
  });
}

export async function patchRecommendation(
  id: string,
  payload: {
    name?: string;
    predicted_date_current?: string | null;
    trigger_type?: string;
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
  payload: {
    dose_per_hectare?: number;
    dose_unit?: string;
    mix_order_override?: number | null;
  },
) {
  const { data } = await api.patch(`/recommendation_items/${id}`, payload);
  return data;
}

export async function deleteRecommendationItem(id: string) {
  const { data } = await api.delete(`/recommendation_items/${id}`);
  return data;
}

export interface PlotHistoryRec {
  id: string;
  name: string;
  status: "PENDING" | "APPLIED_ON_TIME" | "APPLIED_LATE" | "SKIPPED";
  predicted_date_current: string | null;
  executed_date: string | null;
  items: Array<{
    product_name: string;
    dose_per_hectare: number;
    dose_unit: string;
  }>;
}

export interface PlotHistorySeason {
  id: string;
  crop: string;
  variety: string | null;
  status: string;
  planting_date: string | null;
  created_at: string;
  is_current: boolean;
  recommendations: PlotHistoryRec[];
}

export async function getPlotHistory(seasonId: string): Promise<PlotHistorySeason[]> {
  const { data } = await api.get<PlotHistorySeason[]>(`/seasons/${seasonId}/plot-history`);
  return data;
}
