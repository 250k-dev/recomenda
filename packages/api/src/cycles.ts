import { api } from "./http/axios";

/** Safra da fazenda (`crop_cycles`): agrupa as programações por talhão. */

/** Fazenda participante de uma safra multi-fazenda, com a área cadastrada somada. */
export interface CycleFarmRow {
  id: string;
  name: string;
  /** Localização livre da fazenda — vai para a ficha do talhão nos documentos. */
  location?: string | null;
  area_hectares_sum: number;
}

export interface CycleSummary {
  id: string;
  farm_id: string;
  producer_id: string;
  name: string;
  crops: string[];
  status: "ACTIVE" | "HARVESTED" | "ARCHIVED";
  created_at: string;
  plots_count: number;
  area_ha: number;
  recommendations_total: number;
  recommendations_done: number;
  progress_pct: number;
  purchase_list_id: string | null;
  has_draft_seasons: boolean;
  /** Safra criada mas ainda sem talhões programados. */
  is_planning: boolean;
  /** Lista ACTIVE incompleta — bloqueia publicar e mostra badge na UI. */
  awaiting_purchase: boolean;
  /** Incluir fazenda enquanto a programação ainda não foi publicada. */
  can_add_farms: boolean;
  /** Fazendas participantes da safra (multi-fazenda) — sempre ao menos uma. */
  farms: CycleFarmRow[];
  /** Soma da área cadastrada de todas as fazendas da safra (não só a programada). */
  total_cadastral_hectares: number;
}

/** Uma variedade plantada num talhão, com a área que ocupa. */
export interface SeasonVariety {
  variety: string;
  planted_area_ha: number | null;
  thousand_plants_per_ha?: number | null;
}

export interface CycleSeasonRow {
  id: string;
  plot_id: string;
  plot_name: string;
  farm_id?: string;
  farm_name?: string;
  plot_area_ha: number;
  planted_area_ha: number | null;
  crop: string;
  /** Variedade primária (compat) — é `varieties[0]`. */
  variety: string | null;
  /** Todas as variedades do talhão (pode ser mais de uma, com áreas próprias). */
  varieties: SeasonVariety[];
  status: string;
  planting_date: string | null;
  desiccation_date: string | null;
  cycle_days: number | null;
  recommendations_total: number;
  recommendations_done: number;
  /** Etapas em PENDING — o que é descartado ao aplicar um modelo neste talhão. */
  recommendations_pending?: number;
}

export interface CycleBlock {
  timing_template_id: string;
  template_name: string;
  plots_count: number;
  stage_names: string[];
}

export interface CycleDetail {
  id: string;
  farm_id: string;
  producer_id: string;
  agronomist_id: string;
  name: string;
  crops: string[];
  status: "ACTIVE" | "HARVESTED" | "ARCHIVED";
  created_at: string;
  seasons: CycleSeasonRow[];
  blocks: CycleBlock[];
  purchase_list_id: string | null;
  purchase_list_name: string | null;
  /** Lista ACTIVE incompleta — bloqueia publicar e mostra badge na UI. */
  awaiting_purchase: boolean;
  /** Incluir fazenda enquanto a programação ainda não foi publicada. */
  can_add_farms: boolean;
  /** Fazendas participantes da safra (multi-fazenda) — sempre ao menos uma. */
  farms: CycleFarmRow[];
  /** Soma da área cadastrada de todas as fazendas da safra (não só a programada). */
  total_cadastral_hectares: number;
}

export interface CycleAvailablePlot {
  id: string;
  name: string;
  area_hectares: number;
  in_other_cycle: boolean;
  other_cycle_name: string | null;
  farm_id: string;
  farm_name: string;
}

export interface CycleCostPlanPlotRow {
  season_id: string;
  plot_id: string;
  plot_name: string;
  crop: string;
  area_ha: number;
  cost_per_ha_brl: number;
  total_brl: number;
}

export interface CycleCostPlanCropRow {
  crop: string;
  total_brl: number;
  share_pct: number;
  total_sacks: number | null;
}

export interface CycleCostPlan {
  cycle_id: string;
  cycle_name: string;
  crops: string[];
  purchase_list_id: string | null;
  total_hectares: number;
  cost_summary: {
    grand_total_brl: number;
    cost_per_ha_brl: number;
    total_sacks: number;
    sacks_per_ha: number;
    category_breakdown: Array<{
      category: string;
      total_brl: number;
      share_pct: number;
      sacks_per_ha: number;
    }>;
  } | null;
  fx_rate_usd_brl: number | null;
  grain_prices_brl: Record<string, number>;
  by_plot: CycleCostPlanPlotRow[];
  by_crop: CycleCostPlanCropRow[];
}

export interface BlockPlotInput {
  plot_id: string;
  crop: string;
  /** Compat: variedade única. Prefira `varieties`. */
  variety?: string | null;
  /** Uma ou mais variedades, cada uma com sua área plantada. */
  varieties?: SeasonVariety[];
  planting_date?: string | null;
  desiccation_date?: string | null;
  cycle_days?: number | null;
  planted_area_ha?: number | null;
}

export interface ApplyBlockPayload {
  timing_template_id: string;
  plots: BlockPlotInput[];
}

export interface ApplyBlockResult {
  applied: string[];
  skipped: string[];
  /**
   * Produto cuja unidade no modelo difere da cadastrada na lista de compra
   * (ex.: L no modelo, Kg na lista). A dose aplicada é a do modelo — isto é
   * aviso, não correção.
   */
  unit_mismatches?: Array<{
    local_product_id: string;
    product_name: string;
    template_unit: string;
    list_unit: string;
  }>;
  cycle: CycleDetail;
}

export async function getFarmCycles(farmId: string) {
  const { data } = await api.get<CycleSummary[]>(`/farms/${farmId}/cycles`);
  return data;
}

export async function getProducerCycles(producerId: string) {
  const { data } = await api.get<CycleSummary[]>(
    `/producers/${producerId}/cycles`,
  );
  return data;
}

export async function createCycle(
  farmId: string,
  payload: {
    producer_id: string;
    name: string;
    crops: string[];
    /** Fazendas participantes da safra. Vazio/ausente = só a fazenda da URL. */
    farm_ids?: string[];
  },
) {
  const { data } = await api.post<CycleDetail>(`/farms/${farmId}/cycles`, payload);
  return data;
}

export async function getCycle(id: string) {
  const { data } = await api.get<CycleDetail>(`/cycles/${id}`);
  return data;
}

export async function updateCycle(
  id: string,
  payload: { name?: string; crops?: string[]; status?: string },
) {
  const { data } = await api.patch<CycleDetail>(`/cycles/${id}`, payload);
  return data;
}

export async function getCycleAvailablePlots(id: string) {
  const { data } = await api.get<CycleAvailablePlot[]>(`/cycles/${id}/available-plots`);
  return data;
}

export async function applyCycleBlock(id: string, payload: ApplyBlockPayload) {
  const { data } = await api.post<ApplyBlockResult>(`/cycles/${id}/blocks`, payload);
  return data;
}

/** Resultado do realinhamento das doses da lista com a programação. */
export interface SyncListDosesResult {
  updated: number;
  conflicts: Array<{
    product_name: string;
    stage: string;
    reason: "purchase_confirmed";
  }>;
}

/** Leva as doses da programação para a lista de compra da safra. */
export async function syncCycleListDoses(cycleId: string) {
  const { data } = await api.post<SyncListDosesResult>(
    `/cycles/${cycleId}/sync-list-doses`,
  );
  return data;
}

export async function publishCycle(id: string) {
  const { data } = await api.post<CycleDetail>(`/cycles/${id}/publish`);
  return data;
}

export async function getCycleCostPlan(id: string) {
  const { data } = await api.get<CycleCostPlan>(`/cycles/${id}/cost-plan`);
  return data;
}

/** Exclui (arquiva) a safra e remove a lista de compra vinculada. */
export async function deleteCycle(id: string) {
  const { data } = await api.delete<{
    success: boolean;
    id: string;
    producer_id?: string;
    farm_id?: string;
    farm_ids?: string[];
  }>(`/cycles/${id}`);
  return data;
}

/** Vincula uma fazenda a mais à safra (multi-fazenda). */
export async function addCycleFarm(cycleId: string, farmId: string) {
  const { data } = await api.post<CycleDetail>(`/cycles/${cycleId}/farms`, {
    farm_id: farmId,
  });
  return data;
}

/** Desvincula uma fazenda da safra. Pode falhar com `FARM_HAS_ACTIVE_SEASONS`
 *  ou `FARM_LOCKED_BY_PURCHASES` — ver `apiErrorMessage`. */
export async function removeCycleFarm(cycleId: string, farmId: string) {
  const { data } = await api.delete<CycleDetail>(`/cycles/${cycleId}/farms/${farmId}`);
  return data;
}
