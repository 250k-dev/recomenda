/**
 * Motor de cálculo do plano de custo de safra.
 * Fórmulas espelhadas do Excel do cliente de referência. Versão pura: recebe números,
 * devolve números. Conversões de string (decimals do TypeORM) acontecem nos callers.
 */

export type CostPerHaMode = "DOSE_PRICE" | "TOTAL_OVER_AREA";
export type CalcRule = "STANDARD" | "SEED_POPULATION" | "SEED_BAGS" | null;

export interface CostItemInput {
  id: string;
  category: string;
  product_name: string;
  dose_per_hectare: number;
  dose_unit: string;
  n_applications: number;
  current_stock: number;
  area_factor: number;
  price_usd: number | null;
  price_brl_fixed: number | null;
  /** Preço em USD vindo do catálogo (fallback se item não tiver override). */
  catalog_price_usd: number | null;
  cost_per_ha_mode: CostPerHaMode;
  deduct_stock: boolean;
  calc_rule: CalcRule;
  /** Para SEED_BAGS: qtde de população de base (G_pop). */
  population_base?: number | null;
}

export interface CostParams {
  area_hectares: number;
  fx_rate_usd_brl: number | null;
  grain_price_brl: number | null;
}

export interface CostLineResult {
  id: string;
  /** G — Qtde final que ainda precisa ser comprada. */
  quantity_final: number;
  /** I — Preço unitário em R$. */
  unit_price_brl: number;
  /** K — Total em R$. */
  total_brl: number;
  /** J — Custo por hectare em R$. */
  cost_per_ha_brl: number;
}

export interface CategoryBreakdown {
  category: string;
  total_brl: number;
  share_pct: number;
  sacks_per_ha: number;
}

export interface CostSummary {
  grand_total_brl: number;
  cost_per_ha_brl: number;
  total_sacks: number;
  sacks_per_ha: number;
  category_breakdown: CategoryBreakdown[];
}

/** Ordem canônica das categorias na sidebar do plano. */
export const CATEGORY_ORDER = [
  "SEED",
  "FERTILIZER",
  "HERBICIDE",
  "FUNGICIDE",
  "INSECTICIDE",
  "BIOLOGICAL",
  "SEED_TREATMENT",
  "FOLIAR",
  "ADJUVANT",
  "OTHER",
];

/** Calcula uma linha do plano. */
export function calculateLine(item: CostItemInput, params: CostParams): CostLineResult {
  const area = params.area_hectares;
  const dose = item.dose_per_hectare;
  const nApps = item.n_applications || 1;
  const stock = item.current_stock || 0;

  // G — Qtde final
  let G: number;
  if (item.calc_rule === "SEED_POPULATION") {
    // População de sementes: usa population_base como "G_pop" (caso vier preenchido).
    G = item.population_base ?? 0;
    if (item.deduct_stock) G = G - stock;
  } else if (item.calc_rule === "SEED_BAGS") {
    G = (item.population_base ?? 0) * 25;
  } else if (!item.deduct_stock) {
    G = dose * area * nApps;
  } else if (item.area_factor < 1) {
    G = (dose * area * nApps - stock) * item.area_factor;
  } else {
    G = dose * area * nApps - stock;
  }

  // I — Preço unitário R$
  let I: number;
  if (item.price_brl_fixed != null && item.price_brl_fixed > 0) {
    I = item.price_brl_fixed;
  } else {
    const usd = item.price_usd ?? item.catalog_price_usd ?? 0;
    const fx = params.fx_rate_usd_brl ?? 0;
    I = usd * fx;
  }

  // K — Total
  const K = Math.max(0, G) * I;

  // J — Custo por hectare
  let J: number;
  if (item.calc_rule === "SEED_POPULATION" || item.calc_rule === "SEED_BAGS") {
    // Sementes: custo/ha é o total rateado pela área (dose não se aplica).
    J = area > 0 ? K / area : 0;
  } else if (item.cost_per_ha_mode === "DOSE_PRICE") {
    J = I * dose * nApps;
  } else {
    J = area > 0 ? K / area : 0;
  }

  return {
    id: item.id,
    quantity_final: G,
    unit_price_brl: I,
    total_brl: K,
    cost_per_ha_brl: J,
  };
}

/** Calcula o resumo agregado (KPIs + categorias). */
export function calculateSummary(
  items: CostItemInput[],
  params: CostParams,
): { lines: CostLineResult[]; summary: CostSummary } {
  const lines = items.map((it) => calculateLine(it, params));
  const grandTotal = lines.reduce((s, l) => s + l.total_brl, 0);
  const area = params.area_hectares;
  const grainPrice = params.grain_price_brl ?? 0;
  const totalSacks = grainPrice > 0 ? grandTotal / grainPrice : 0;

  // Agrupa por categoria respeitando a ordem canônica.
  const totalsByCategory = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const cat = items[i].category || "OTHER";
    totalsByCategory.set(cat, (totalsByCategory.get(cat) ?? 0) + lines[i].total_brl);
  }

  const categories = Array.from(totalsByCategory.keys()).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const category_breakdown: CategoryBreakdown[] = categories.map((cat) => {
    const total = totalsByCategory.get(cat) ?? 0;
    const share = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
    const sacks_per_ha =
      grainPrice > 0 && area > 0 ? total / grainPrice / area : 0;
    return { category: cat, total_brl: total, share_pct: share, sacks_per_ha };
  });

  return {
    lines,
    summary: {
      grand_total_brl: grandTotal,
      cost_per_ha_brl: area > 0 ? grandTotal / area : 0,
      total_sacks: totalSacks,
      sacks_per_ha: area > 0 ? totalSacks / area : 0,
      category_breakdown,
    },
  };
}
