import type { PurchaseListDetail } from "@recomenda/api/purchase-lists";

type StageProductLike = {
  productId: string;
  productName: string;
  dose: string;
  unit: string;
};

type StageLike = {
  products: StageProductLike[];
};

export type PurchaseListBudgetOverage = {
  productId: string;
  productName: string;
  unit: string;
  plannedDosePerHa: number;
  recommendedDosePerHa: number;
  excessDosePerHa: number;
};

function parseDose(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function plannedDosePerHaFromItem(
  item: PurchaseListDetail["items"][number],
  listHectares: number,
): number {
  if (listHectares > 0 && item.required_quantity > 0) {
    return item.required_quantity / listHectares;
  }
  return item.dose_per_hectare * (item.n_applications || 1);
}

export function aggregatePurchaseListDosePerHa(
  lists: PurchaseListDetail[],
  crop?: string,
): Map<string, { productName: string; unit: string; dosePerHa: number }> {
  const map = new Map<string, { productName: string; unit: string; dosePerHa: number }>();
  const filtered = crop
    ? lists.filter((list) => list.crop === crop || list.crop === "ANY")
    : lists;

  for (const list of filtered) {
    const hectares = list.total_hectares > 0 ? list.total_hectares : 0;
    for (const item of list.items) {
      const dosePerHa = plannedDosePerHaFromItem(item, hectares);
      const existing = map.get(item.local_product_id);
      if (existing) {
        existing.dosePerHa += dosePerHa;
      } else {
        map.set(item.local_product_id, {
          productName: item.product_name,
          unit: item.dose_unit,
          dosePerHa,
        });
      }
    }
  }

  return map;
}

export function aggregateRecommendedDosePerHa(
  stages: StageLike[],
): Map<string, { productName: string; unit: string; dosePerHa: number }> {
  const map = new Map<string, { productName: string; unit: string; dosePerHa: number }>();

  for (const stage of stages) {
    for (const product of stage.products) {
      if (!product.productId) continue;
      const dose = parseDose(product.dose);
      if (dose <= 0) continue;

      const existing = map.get(product.productId);
      if (existing) {
        existing.dosePerHa += dose;
        if (!existing.productName && product.productName) {
          existing.productName = product.productName;
        }
      } else {
        map.set(product.productId, {
          productName: product.productName,
          unit: product.unit || "L",
          dosePerHa: dose,
        });
      }
    }
  }

  return map;
}

export function findPurchaseListOverages(
  stages: StageLike[],
  purchaseLists: PurchaseListDetail[],
  crop?: string,
): PurchaseListBudgetOverage[] {
  const planned = aggregatePurchaseListDosePerHa(purchaseLists, crop);
  const recommended = aggregateRecommendedDosePerHa(stages);
  const overages: PurchaseListBudgetOverage[] = [];

  for (const [productId, rec] of recommended) {
    const budget = planned.get(productId);
    const plannedDose = budget?.dosePerHa ?? 0;
    if (rec.dosePerHa <= plannedDose + 0.0001) continue;

    overages.push({
      productId,
      productName: rec.productName || budget?.productName || "Produto",
      unit: rec.unit || budget?.unit || "L",
      plannedDosePerHa: plannedDose,
      recommendedDosePerHa: rec.dosePerHa,
      excessDosePerHa: rec.dosePerHa - plannedDose,
    });
  }

  return overages.sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR"));
}

export function formatDosePerHa(value: number, unit: string): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit}/ha`;
}
