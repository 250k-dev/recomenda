import { api } from "@/lib/http/axios";

/** Safra da fazenda (`crop_cycles`): agrupa as programações por talhão. */

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
}

export interface CycleSeasonRow {
  id: string;
  plot_id: string;
  plot_name: string;
  plot_area_ha: number;
  planted_area_ha: number | null;
  crop: string;
  variety: string | null;
  status: string;
  planting_date: string | null;
  desiccation_date: string | null;
  cycle_days: number | null;
  recommendations_total: number;
  recommendations_done: number;
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
}

export interface CycleAvailablePlot {
  id: string;
  name: string;
  area_hectares: number;
  in_other_cycle: boolean;
  other_cycle_name: string | null;
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
  variety?: string | null;
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
  cycle: CycleDetail;
}

export async function getFarmCycles(farmId: string) {
  const { data } = await api.get<CycleSummary[]>(`/farms/${farmId}/cycles`);
  return data;
}

export async function createCycle(
  farmId: string,
  payload: { producer_id: string; name: string; crops: string[] },
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

export async function publishCycle(id: string) {
  const { data } = await api.post<CycleDetail>(`/cycles/${id}/publish`);
  return data;
}

export async function getCycleCostPlan(id: string) {
  const { data } = await api.get<CycleCostPlan>(`/cycles/${id}/cost-plan`);
  return data;
}
