import { api } from "@/lib/http/axios";

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
  /** Variedade/Híbrido: população em plantas/ha (nº de sementes por hectare). */
  thousand_plants_per_ha?: number | null;
  /** Variedade/Híbrido: área a ser semeada (ha). */
  seeding_area_ha?: number | null;
  /** Semente: bags/sacos ajustados à mão (sobrepõe o cálculo). */
  bags_override?: number | null;
  /** Produto fora da lista/programação (destaque vermelho). */
  out_of_program?: boolean;
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
    thousand_plants_per_ha: number | null;
    seeding_area_ha: number | null;
    bags_override: number | null;
    out_of_program: boolean;
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
