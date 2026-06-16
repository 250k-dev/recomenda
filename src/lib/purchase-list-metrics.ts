import type { PurchaseListDetail } from "@/lib/api/purchase-lists";

export function isPurchaseListFullyPriced(list: PurchaseListDetail): boolean {
  if (list.items.length === 0) return false;
  return list.items.every(
    (item) => item.price_brl_fixed != null && item.price_brl_fixed > 0,
  );
}

export function computePortfolioPriceCoverage(lists: PurchaseListDetail[]) {
  const totalLists = lists.length;
  const completeLists = lists.filter(isPurchaseListFullyPriced).length;
  const pendingLists = totalLists - completeLists;
  const pct =
    totalLists > 0 ? Math.round((completeLists / totalLists) * 100) : 0;

  return { totalLists, completeLists, pendingLists, pct };
}
