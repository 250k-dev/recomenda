import type { RecommendationItem } from "@recomenda/api";

/** Ordem efetiva de mistura no tanque (menor = primeiro). */
export function recommendationItemMixOrder(item: RecommendationItem): number {
  if (typeof item.mix_order === "number" && Number.isFinite(item.mix_order)) {
    return item.mix_order;
  }
  if (
    typeof item.mix_order_override === "number" &&
    Number.isFinite(item.mix_order_override)
  ) {
    return item.mix_order_override;
  }
  return 999;
}

/** Ordena produtos da etapa pela ordem de mistura (exports, UI, WhatsApp). */
export function sortRecommendationItemsByMixOrder<T extends RecommendationItem>(
  items: T[],
): T[] {
  return items
    .slice()
    .sort((a, b) => recommendationItemMixOrder(a) - recommendationItemMixOrder(b));
}
