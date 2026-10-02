/**
 * Métricas agregadas da lista de compra em **sacas**, espelhando o cabeçalho da
 * planilha do cliente (VALOR TOTAL · VOLUME SC/HÁ · VOLUME SC TOTAL) e o gráfico
 * de distribuição por categoria do plano de custo.
 *
 * Trabalha sobre o `ListItem` do formulário (não o modelo do plano de custo), então
 * é reutilizável tanto na aba da lista quanto no wizard de criação.
 */
import {
  isSeedItem,
  listItemQuantity,
  listItemsToBuyByKey,
  type ListItem,
} from "./list-item";
import { CATEGORY_ORDER, type CategoryBreakdown } from "../cost-plan/calculate";
import type { PurchaseListDetail } from "@recomenda/api/purchase-lists";

/** Converte um item persistido da lista no `ListItem` do cálculo. */
export function detailItemToListItem(
  it: PurchaseListDetail["items"][number],
): ListItem {
  return {
    key: it.id,
    category: it.category ?? "OTHER",
    productId: it.local_product_id,
    productName: it.product_name,
    equivalenceGroup: it.equivalence_group ?? null,
    stage: it.stage,
    dose: String(it.dose_per_hectare),
    unit: it.dose_unit,
    nApps: String(it.n_applications),
    stock: String(it.current_stock),
    applied: Number(it.applied_quantity) || 0,
    price: it.price_brl_fixed != null ? String(it.price_brl_fixed) : "",
    priceUsd: it.price_usd != null ? String(it.price_usd) : "",
    seedsPerMeter: it.seeds_per_meter != null ? String(it.seeds_per_meter) : "",
    thousandSeedWeight:
      it.thousand_seed_weight_g != null ? String(it.thousand_seed_weight_g) : "",
    cycleDays: it.cycle_days != null ? String(it.cycle_days) : "",
    thousandPlants:
      it.thousand_plants_per_ha != null ? String(it.thousand_plants_per_ha) : "",
    seedingArea: it.seeding_area_ha != null ? String(it.seeding_area_ha) : "",
    bagsOverride: it.bags_override != null ? String(it.bags_override) : undefined,
    volumeOverride: it.volume_override != null ? String(it.volume_override) : undefined,
    outOfProgram: it.out_of_program || undefined,
    // `area_factor` vem como fração (0..1); no formulário editamos em %.
    areaPercent:
      it.area_factor != null && it.area_factor > 0 && it.area_factor !== 1
        ? String(Number((it.area_factor * 100).toFixed(4)))
        : "",
    areaNote: it.area_note ?? "",
    executionPlots: it.execution_plots ?? undefined,
  };
}

export interface PurchaseListMetrics {
  /** Custo total dos defensivos/fertilizantes (R$). */
  totalProductsValue: number;
  /** Custo total das sementes (R$). */
  totalSeedsValue: number;
  /** Custo total geral da programação (produtos + sementes) — VALOR TOTAL. */
  totalValue: number;
  /** Volume total de sacas/BAGs de semente a comprar (só o físico da semente). */
  seedVolume: number;
  /** Sacas de semente por hectare (físico da semente ÷ hectares). */
  seedSacksPerHa: number;
  /**
   * VOLUME SC TOTAL: custo da **programação** (dose × área, sem descontar
   * estoque) convertido em sacas de grão (valor ÷ saca).
   */
  totalSacks: number;
  /**
   * VOLUME SC/HÁ: custo da programação ÷ saca ÷ ha.
   * Estoque só reduz a qtde a comprar — não o custo sc/ha da lavoura.
   */
  costSacksPerHa: number;
  productsCount: number;
  categoriesCount: number;
  pricedCount: number;
  /** Distribuição por categoria (para o gráfico de gastos). */
  categoryBreakdown: CategoryBreakdown[];
}

/** Cultura da semente pela categoria (null = insumo comum às culturas). */
function seedCropOf(category: string): string | null {
  if (category === "CULTIVAR_SOJA") return "SOYBEAN";
  if (category === "HIBRIDO_MILHO") return "CORN";
  if (category === "CULTIVAR_FEIJAO") return "BEAN";
  return null;
}

/**
 * `cropPrices`: preço da saca por cultura (safra com mais de uma). A semente de
 * cada cultura converte em sacas pelo preço dela; insumo comum usa `grainPrice`
 * (a cultura principal da safra).
 */
export function computePurchaseListMetrics(
  items: ListItem[],
  totalHa: number,
  fxRate: number,
  grainPrice: number,
  cropPrices?: Record<string, number> | null,
): PurchaseListMetrics {
  let totalProductsValue = 0;
  let totalSeedsValue = 0;
  let seedVolume = 0;
  let pricedCount = 0;
  let totalSacks = 0;
  const categoryTotals = new Map<string, number>();
  const categorySacks = new Map<string, number>();
  const mainPrice = grainPrice > 0 ? grainPrice : 0;
  const priceOf = (it: ListItem): number => {
    const crop = seedCropOf(it.category);
    const own = crop ? Number(cropPrices?.[crop] ?? 0) : 0;
    return own > 0 ? own : mainPrice;
  };

  const toBuyByKey = listItemsToBuyByKey(items, totalHa);
  for (const it of items) {
    const toBuy = toBuyByKey.get(it.key) ?? 0;
    const unitPrice =
      it.priceUsd && fxRate > 0 ? Number(it.priceUsd) * fxRate : Number(it.price || 0);
    const seed = isSeedItem(it);
    // Custo da lavoura: volume programado (dose × ha × % área). Galpão e
    // aplicação não entram — senão sc/ha cai só porque já tem produto no pátio.
    const programQty = listItemQuantity(it, totalHa);
    const lineTotal = programQty * unitPrice;

    if (seed) seedVolume += toBuy;
    if (unitPrice > 0) {
      if (seed) totalSeedsValue += lineTotal;
      else totalProductsValue += lineTotal;
      pricedCount += 1;
    }
    const cat = it.category || "OTHER";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + lineTotal);
    const itemPrice = priceOf(it);
    const itemSacks = itemPrice > 0 ? lineTotal / itemPrice : 0;
    totalSacks += itemSacks;
    categorySacks.set(cat, (categorySacks.get(cat) ?? 0) + itemSacks);
  }

  const totalValue = totalProductsValue + totalSeedsValue;

  const categoryBreakdown: CategoryBreakdown[] = [...categoryTotals.keys()]
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map((cat) => {
      const total = categoryTotals.get(cat) ?? 0;
      return {
        category: cat,
        total_brl: total,
        share_pct: totalValue > 0 ? (total / totalValue) * 100 : 0,
        sacks_per_ha: totalHa > 0 ? (categorySacks.get(cat) ?? 0) / totalHa : 0,
      };
    });

  return {
    totalProductsValue,
    totalSeedsValue,
    totalValue,
    seedVolume,
    seedSacksPerHa: totalHa > 0 ? seedVolume / totalHa : 0,
    totalSacks,
    costSacksPerHa: totalHa > 0 ? totalSacks / totalHa : 0,
    productsCount: items.length,
    categoriesCount: categoryTotals.size,
    pricedCount,
    categoryBreakdown,
  };
}

/**
 * Quando a lista não tem preço por item, o total informado na mão vira
 * valor/sacas/sc-ha do resumo — sem ratear nas categorias.
 */
export function applyManualTotalSpent(
  metrics: PurchaseListMetrics,
  manualTotal: number | null | undefined,
  grainPrice: number,
  totalHa: number,
): PurchaseListMetrics {
  if (metrics.pricedCount > 0) return metrics;
  if (manualTotal == null || !Number.isFinite(manualTotal) || manualTotal <= 0) {
    return metrics;
  }
  const gp = grainPrice > 0 ? grainPrice : 0;
  return {
    ...metrics,
    totalValue: manualTotal,
    totalSacks: gp > 0 ? manualTotal / gp : 0,
    costSacksPerHa: gp > 0 && totalHa > 0 ? manualTotal / gp / totalHa : 0,
  };
}

export function usesManualListTotal(
  metrics: PurchaseListMetrics,
  manualTotal: number | null | undefined,
): boolean {
  return (
    metrics.pricedCount === 0 &&
    manualTotal != null &&
    Number.isFinite(manualTotal) &&
    manualTotal > 0
  );
}
