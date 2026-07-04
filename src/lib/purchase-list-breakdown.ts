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
  type ListItem,
} from "@/components/domain/season/_shared";
import { CATEGORY_ORDER, type CategoryBreakdown } from "@/lib/cost-plan/calculate";
import type { PurchaseListDetail } from "@/lib/api/purchase-lists";

/** Converte um item persistido da lista no `ListItem` do cálculo. */
export function detailItemToListItem(
  it: PurchaseListDetail["items"][number],
): ListItem {
  return {
    key: it.id,
    category: it.category ?? "OTHER",
    productId: it.local_product_id,
    productName: it.product_name,
    stage: it.stage,
    dose: String(it.dose_per_hectare),
    unit: it.dose_unit,
    nApps: String(it.n_applications),
    stock: String(it.current_stock),
    price: it.price_brl_fixed != null ? String(it.price_brl_fixed) : "",
    priceUsd: it.price_usd != null ? String(it.price_usd) : "",
    seedsPerMeter: it.seeds_per_meter != null ? String(it.seeds_per_meter) : "",
    cycleDays: it.cycle_days != null ? String(it.cycle_days) : "",
    thousandPlants:
      it.thousand_plants_per_ha != null ? String(it.thousand_plants_per_ha) : "",
    seedingArea: it.seeding_area_ha != null ? String(it.seeding_area_ha) : "",
    bagsOverride: it.bags_override != null ? String(it.bags_override) : undefined,
    outOfProgram: it.out_of_program || undefined,
  };
}

export interface PurchaseListMetrics {
  /** Custo total dos defensivos/fertilizantes (R$). */
  totalProductsValue: number;
  /** Custo total das sementes (R$). */
  totalSeedsValue: number;
  /** Custo total geral (produtos + sementes) — VALOR TOTAL da planilha. */
  totalValue: number;
  /** Volume total de sacas/BAGs de semente a comprar — VOLUME SC TOTAL. */
  seedVolume: number;
  /** Sacas de semente por hectare — VOLUME SC/HÁ (pedido: volume ÷ hectares). */
  seedSacksPerHa: number;
  /** Custo dos produtos convertido em sacas/ha (valor ÷ saca ÷ hectares). */
  productCostSacksPerHa: number;
  productsCount: number;
  categoriesCount: number;
  pricedCount: number;
  /** Distribuição por categoria (para o gráfico de gastos). */
  categoryBreakdown: CategoryBreakdown[];
}

export function computePurchaseListMetrics(
  items: ListItem[],
  totalHa: number,
  fxRate: number,
  grainPrice: number,
): PurchaseListMetrics {
  let totalProductsValue = 0;
  let totalSeedsValue = 0;
  let seedVolume = 0;
  let pricedCount = 0;
  const categoryTotals = new Map<string, number>();

  for (const it of items) {
    const required = listItemQuantity(it, totalHa);
    const toBuy = Math.max(0, required - Number(it.stock || 0));
    const unitPrice =
      it.priceUsd && fxRate > 0 ? Number(it.priceUsd) * fxRate : Number(it.price || 0);
    const seed = isSeedItem(it);
    const lineTotal = toBuy * unitPrice;

    if (seed) seedVolume += toBuy;
    if (unitPrice > 0) {
      if (seed) totalSeedsValue += lineTotal;
      else totalProductsValue += lineTotal;
      pricedCount += 1;
    }
    const cat = it.category || "OTHER";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + lineTotal);
  }

  const totalValue = totalProductsValue + totalSeedsValue;
  const gp = grainPrice > 0 ? grainPrice : 0;

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
        sacks_per_ha: gp > 0 && totalHa > 0 ? total / gp / totalHa : 0,
      };
    });

  return {
    totalProductsValue,
    totalSeedsValue,
    totalValue,
    seedVolume,
    seedSacksPerHa: totalHa > 0 ? seedVolume / totalHa : 0,
    productCostSacksPerHa:
      gp > 0 && totalHa > 0 ? totalProductsValue / gp / totalHa : 0,
    productsCount: items.length,
    categoriesCount: categoryTotals.size,
    pricedCount,
    categoryBreakdown,
  };
}
