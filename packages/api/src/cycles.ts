import { api } from "./http/axios";
import type { PlotHistoryRec } from "./seasons";

/** Safra da fazenda (`crop_cycles`): agrupa as programações por talhão. */

/** Fazenda participante de uma safra multi-fazenda, com a área cadastrada somada. */
export interface CycleFarmRow {
  id: string;
  name: string;
  /** Localização livre da fazenda — vai para a ficha do talhão nos documentos. */
  location?: string | null;
  /** Tanque do pulverizador (L) — padrão das receitas de aplicação. */
  tank_capacity_l?: number | null;
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
  closed_at?: string | null;
  /** Arquivo de safra antiga em preenchimento — some da lista operacional. */
  backfill?: boolean;
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
  /** Etapas em PENDING — o que `applyTemplate` apaga ao aplicar um modelo neste talhão. */
  recommendations_pending?: number;
  harvest_total_bags?: number | null;
  harvest_bags_per_hectare?: number | null;
  harvest_date?: string | null;
  /** Cadastro do talhão foi excluído — a programação ficou órfã. */
  plot_missing?: boolean;
}

export interface CycleBlock {
  timing_template_id: string;
  template_name: string;
  plots_count: number;
  plots: Array<{ plot_name: string; farm_name: string }>;
  stage_names: string[];
}

export interface CycleDetail {
  id: string;
  farm_id: string;
  producer_id: string;
  agronomist_id: string;
  name: string;
  crops: string[];
  /** Talhões da safra (escolhidos na criação + programados). */
  plots?: CyclePlotRow[];
  /** Área total que a safra cobre — a mesma da lista de compra. */
  plots_area_ha?: number;
  status: "ACTIVE" | "HARVESTED" | "ARCHIVED";
  created_at: string;
  closed_at?: string | null;
  backfill?: boolean;
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
  /** Escolhido para a safra (os demais entram nela ao serem programados). */
  in_cycle?: boolean;
  /** Área do talhão na safra (null = cadastral). */
  cycle_area_ha?: number | null;
}

/** Talhão da safra: escolhido na criação e/ou programado. */
export interface CyclePlotRow {
  plot_id: string;
  plot_name: string;
  farm_id: string;
  farm_name: string;
  /** Área cadastral do talhão. */
  plot_area_ha: number;
  /** Área do talhão na safra (null = cadastral). */
  cycle_area_ha: number | null;
  /** Área que entra na lista de compra (plantada > safra > cadastral). */
  area_ha: number;
  programmed: boolean;
  in_cycle: boolean;
}

/** Talhão escolhido para a safra. `area_ha` vazio = área cadastral. */
export interface CyclePlotInput {
  plot_id: string;
  area_ha?: number | null;
}

/** Talhão → safras ativas em que ele já está e quanto de área cada uma usa. */
export interface PlotCycleUsage {
  plot_id: string;
  plot_area_ha: number;
  used_ha: number;
  /** Área do talhão ainda sem safra (0 = ocupado por inteiro). */
  free_ha: number;
  cycles: Array<{ id: string; name: string; area_ha: number }>;
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
  /** Só aviso: aplicar bloco não grava dose/unidade na lista. */
  list_impact?: SyncListDosesResult;
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
    /** Talhões da safra (com área parcial opcional). */
    plots?: CyclePlotInput[];
    backfill?: boolean;
    closed_at?: string;
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
  shortages?: Array<{
    product_name: string;
    stage: string;
    confirmed_qty: number;
  }>;
}

export async function applyCycleTemplateBulk(
  cycleId: string,
  payload: { timing_template_id: string; season_ids: string[] },
) {
  const { data } = await api.post<{
    ok: number;
    failed: number;
    errors: Array<{ seasonId: string; label: string; message: string }>;
    list_impact?: SyncListDosesResult;
  }>(`/cycles/${cycleId}/apply-template`, payload);
  return data;
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

export type CycleRestorePosition = "first" | "last";

export interface CycleRestorePreviewLine {
  local_product_id: string;
  product_name: string;
  dose_unit: string | null;
  required: number;
  in_stock: number;
}

export interface CycleRestorePreviewLoss {
  local_product_id: string;
  product_name: string;
  dose_unit: string | null;
  list_id: string;
  cycle_name: string;
  before: number;
  after: number;
  lost: number;
}

export interface CycleRestoreSimulation {
  received: CycleRestorePreviewLine[];
  losses: CycleRestorePreviewLoss[];
}

/** Prévia de "Recuperar safra": impacto no galpão de cada posição na fila. */
export interface CycleRestorePreview {
  /** Há outras safras disputando o galpão — o agrônomo escolhe a posição. */
  has_queue: boolean;
  reserves_stock: boolean;
  /** Como a safra volta: ativa, colhida ou arquivo de safra antiga. */
  restores_as: "active" | "harvested" | "historical";
  first: CycleRestoreSimulation;
  last: CycleRestoreSimulation;
  plots_in_other_cycles: Array<{ plot_id: string; plot_name: string; cycle_name: string }>;
}

export async function getCycleRestorePreview(id: string) {
  const { data } = await api.get<CycleRestorePreview>(`/cycles/${id}/restore-preview`);
  return data;
}

/** Recupera a safra arquivada na posição escolhida da fila do galpão. */
export async function restoreCycle(id: string, position: CycleRestorePosition) {
  const { data } = await api.post<CycleDetail>(`/cycles/${id}/restore`, { position });
  return data;
}

/** Vincula uma fazenda a mais à safra (multi-fazenda). */
export async function addCycleFarm(cycleId: string, farmId: string, plots?: CyclePlotInput[]) {
  const { data } = await api.post<CycleDetail>(`/cycles/${cycleId}/farms`, {
    farm_id: farmId,
    ...(plots ? { plots } : {}),
  });
  return data;
}

/** Inclui talhões na safra (ou atualiza a área dos que já estão). */
export async function addCyclePlots(cycleId: string, plots: CyclePlotInput[]) {
  const { data } = await api.post<CycleDetail>(`/cycles/${cycleId}/plots`, { plots });
  return data;
}

/** Área do talhão na safra. `null` volta para a área cadastral. */
export async function updateCyclePlotArea(cycleId: string, plotId: string, areaHa: number | null) {
  const { data } = await api.patch<CycleDetail>(`/cycles/${cycleId}/plots/${plotId}`, {
    area_ha: areaHa,
  });
  return data;
}

/** Tira o talhão da safra. Falha com `PLOT_HAS_SEASON` se ele tiver programação. */
export async function removeCyclePlot(cycleId: string, plotId: string) {
  const { data } = await api.delete<CycleDetail>(`/cycles/${cycleId}/plots/${plotId}`);
  return data;
}

/** Em quais safras ativas cada talhão do produtor já está. */
export async function getProducerPlotCycleUsage(producerId: string) {
  const { data } = await api.get<PlotCycleUsage[]>(`/producers/${producerId}/cycle-plot-usage`);
  return data;
}

/** Desvincula uma fazenda da safra. Pode falhar com `FARM_HAS_ACTIVE_SEASONS`
 *  ou `FARM_LOCKED_BY_PURCHASES` — ver `apiErrorMessage`. */
export async function removeCycleFarm(cycleId: string, farmId: string) {
  const { data } = await api.delete<CycleDetail>(`/cycles/${cycleId}/farms/${farmId}`);
  return data;
}

export interface CycleHistoryPlot {
  season_id: string;
  plot_id: string;
  plot_name: string;
  farm_id: string;
  farm_name: string;
  area_ha: number;
  crop: string;
  variety: string | null;
  status: string;
  planting_date: string | null;
  harvest_date: string | null;
  harvest_bags_per_hectare: number | null;
  harvest_total_bags: number | null;
  recommendations: PlotHistoryRec[];
}

export interface CycleHistoryConsumption {
  local_product_id: string;
  product_name: string;
  dose_unit: string | null;
  quantity: number;
  total_brl?: number | null;
}

export interface CycleStockSnapshotItem {
  local_product_id: string;
  product_name: string;
  dose_unit: string | null;
  category: string | null;
  quantity: number;
  price_brl: number | null;
  total_brl: number | null;
}

export interface CycleStockSnapshot {
  captured_at: string;
  reason: "HARVEST" | "ARCHIVE";
  total_brl: number | null;
  items: CycleStockSnapshotItem[];
}

export interface CycleHistoryDetail {
  id: string;
  farm_id: string;
  farms: CycleFarmRow[];
  total_cadastral_hectares: number;
  producer_id: string;
  name: string;
  crops: string[];
  status: "ACTIVE" | "HARVESTED" | "ARCHIVED";
  created_at: string;
  closed_at?: string | null;
  backfill?: boolean;
  area_ha: number;
  plots_count: number;
  recommendations_total: number;
  recommendations_done: number;
  harvests_count: number;
  plots: CycleHistoryPlot[];
  consumption: CycleHistoryConsumption[];
  total_brl?: number | null;
  stock_snapshot: CycleStockSnapshot | null;
}

export async function getProducerCycleHistory(
  producerId: string,
  cycleId: string,
) {
  const { data } = await api.get<CycleHistoryDetail>(
    `/producers/${producerId}/history/cycles/${cycleId}`,
  );
  return data;
}

export type CreateHistoricalCyclePayload = {
  name: string;
  crops: string[];
  farm_ids: string[];
  closed_at: string;
  status: "HARVESTED" | "ARCHIVED";
  stock_items?: Array<{
    local_product_id: string;
    quantity: number;
    price_brl?: number | null;
  }>;
};

export async function createProducerHistoricalCycle(
  producerId: string,
  payload: CreateHistoricalCyclePayload,
) {
  const { data } = await api.post<CycleDetail>(
    `/producers/${producerId}/history/cycles`,
    payload,
  );
  return data;
}

export async function concludeHistoryCycle(cycleId: string) {
  const { data } = await api.post<CycleHistoryDetail>(
    `/cycles/${cycleId}/conclude-history`,
  );
  return data;
}
