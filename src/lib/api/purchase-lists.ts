import { api } from "@/lib/http/axios";

export interface PurchaseListItemInput {
  local_product_id: string;
  /** Cultura do item numa lista de safra multi-cultura (null = comum). */
  crop?: string | null;
  stage: string;
  dose_per_hectare: number;
  dose_unit: string;
  n_applications?: number;
  current_stock?: number;
  supplier?: string | null;
  /** Fração da área total (0..1) em que o produto é aplicado. 1 = área toda. */
  area_factor?: number;
  /** Observação livre sobre onde é aplicado (ex.: "áreas sujas"). Não calcula. */
  area_note?: string | null;
  price_usd?: number | null;
  price_brl_fixed?: number | null;
  cost_per_ha_mode?: "DOSE_PRICE" | "TOTAL_OVER_AREA";
  deduct_stock?: boolean;
  calc_rule?: "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;
  /** Variedade/Híbrido: população em plantas/ha (derivada de semente/metro ÷ espaçamento). */
  thousand_plants_per_ha?: number | null;
  /** Variedade/Híbrido: semente por metro (input da planilha). */
  seeds_per_meter?: number | null;
  /** Variedade/Híbrido: ciclo do cultivar em dias (referência). */
  cycle_days?: number | null;
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
  /** Opcional: ausente quando a lista é um template (modelo sem produtor). */
  producer_id?: string;
  /** Marca a lista como template reutilizável (sem produtor/talhões). */
  is_template?: boolean;
  /** Legado (lista de cultura única); listas de safra usam a cultura por item. */
  crop?: string | null;
  /** Safra da fazenda dona da lista — uma lista única por safra. */
  cycle_id?: string | null;
  name: string;
  variety?: string;
  fx_rate_usd_brl?: number | null;
  grain_price_brl?: number | null;
  /** Preço da saca por cultura (CropType → R$/saca) — listas multi-cultura. */
  grain_prices_brl?: Record<string, number>;
  /** Real × Desejado: meta de sacas/ha por categoria. */
  category_targets?: Record<string, number>;
  /** Espaçamento entre linhas (m) — parâmetro único da lista (semente). */
  spacing_m?: number | null;
  season_id?: string | null;
  /** Rascunho (em montagem) × finalizada. Default 'active' no backend. */
  status?: "draft" | "active";
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
  producer_id: string | null;
  is_template?: boolean;
  /** Rascunho (em montagem) × finalizada. Ausente em dados antigos = 'active'. */
  status?: "draft" | "active";
  season_id: string | null;
  cycle_id?: string | null;
  crop: string | null;
  name: string;
  variety: string | null;
  fx_rate_usd_brl: number | null;
  grain_price_brl: number | null;
  grain_prices_brl?: Record<string, number>;
  category_targets?: Record<string, number>;
  spacing_m?: number | null;
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
    crop?: string | null;
    stage: string;
    dose_per_hectare: number;
    dose_unit: string;
    n_applications: number;
    current_stock: number;
    required_quantity: number;
    quantity_to_buy: number;
    supplier: string | null;
    area_factor: number;
    area_note: string | null;
    price_usd: number | null;
    price_brl_fixed: number | null;
    cost_per_ha_mode: "DOSE_PRICE" | "TOTAL_OVER_AREA";
    deduct_stock: boolean;
    calc_rule: "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;
    thousand_plants_per_ha: number | null;
    seeds_per_meter: number | null;
    cycle_days: number | null;
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

/** Lista de compra única da safra (null se ainda não criada). */
export async function getPurchaseListByCycle(cycleId: string) {
  const { data } = await api.get<PurchaseListDetail | null>(
    `/purchase-lists/by-cycle/${cycleId}`,
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

export async function deletePurchaseList(id: string) {
  await api.delete(`/purchase-lists/${id}`);
}

// --- Templates de compra (modelos reutilizáveis) ------------------------------

export async function getPurchaseListTemplates() {
  const { data } = await api.get<PurchaseListDetail[]>("/purchase-lists/templates");
  return data;
}

/** Importa um template para um produtor (cria a lista a partir do modelo). */
export async function importPurchaseListTemplate(
  templateId: string,
  payload: { producer_id: string; name?: string },
) {
  const { data } = await api.post<PurchaseListDetail>(
    `/purchase-lists/${templateId}/import-template`,
    payload,
  );
  return data;
}
