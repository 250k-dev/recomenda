import type { GlobalProduct, PlatformCatalogEntry } from "@/lib/api/catalog";

export type PurchaseListCrop = "SOYBEAN" | "CORN";

export type PurchaseListCatalogProduct = {
  /** Valor usado no formulário (`local_product_id` ou `global:{id}`). */
  optionValue: string;
  name: string;
  category: string;
  dose_unit: string;
  globalId: string | null;
  isGlobalOnly: boolean;
  /** Cultura vinculada (variedades/híbridos). */
  crop?: PurchaseListCrop | null;
};

export function buildPurchaseListCatalog(
  platformEntries: PlatformCatalogEntry[],
  globalProducts: GlobalProduct[],
): PurchaseListCatalogProduct[] {
  const byLocalId = new Map<string, PurchaseListCatalogProduct>();
  const globalIdsWithLocal = new Set<string>();

  for (const entry of platformEntries) {
    if (!entry.local_product_id) continue;
    if (entry.global_product_id) {
      globalIdsWithLocal.add(entry.global_product_id);
    }
    byLocalId.set(entry.local_product_id, {
      optionValue: entry.local_product_id,
      name: entry.name,
      category: entry.category ?? "OTHER",
      dose_unit: entry.dose_unit ?? "L",
      globalId: entry.global_product_id,
      isGlobalOnly: false,
      crop: parseVarietyCrop(entry.equivalence_group),
    });
  }

  for (const globalProduct of globalProducts) {
    if (globalIdsWithLocal.has(globalProduct.id)) continue;
    const optionValue = `global:${globalProduct.id}`;
    if (byLocalId.has(optionValue)) continue;
    const crop = parseVarietyCrop(globalProduct.equivalence_group);
    byLocalId.set(optionValue, {
      optionValue,
      name: globalProduct.name,
      category: globalProduct.category ?? "OTHER",
      dose_unit: globalProduct.dose_unit ?? "L",
      globalId: globalProduct.id,
      isGlobalOnly: true,
      crop,
    });
  }

  return [...byLocalId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

function parseVarietyCrop(value?: string | null): PurchaseListCrop | null {
  if (value === "SOYBEAN" || value === "CORN") return value;
  return null;
}

export function productsForPurchaseListCategory(
  products: PurchaseListCatalogProduct[],
  category: string,
  currentOptionValue?: string,
  currentProductName?: string,
  listCrop?: PurchaseListCrop | null,
): PurchaseListCatalogProduct[] {
  if (!category) return [];

  let filtered = products.filter((product) => product.category === category);

  if (category === "SEED" && listCrop) {
    filtered = filtered.filter(
      (product) => !product.crop || product.crop === listCrop,
    );
  }

  if (
    currentOptionValue &&
    !filtered.some((product) => product.optionValue === currentOptionValue)
  ) {
    const current = products.find((product) => product.optionValue === currentOptionValue);
    if (current?.category === category) {
      return [current, ...filtered];
    }
    if (!current && currentProductName) {
      return [
        {
          optionValue: currentOptionValue,
          name: currentProductName,
          category,
          dose_unit: "L",
          globalId: null,
          isGlobalOnly: false,
        },
        ...filtered,
      ];
    }
  }
  return filtered;
}

export function purchaseListProductLabel(
  product: PurchaseListCatalogProduct,
): string {
  const cropSuffix =
    product.category === "SEED" && product.crop
      ? ` · ${product.crop === "SOYBEAN" ? "Soja" : "Milho"}`
      : "";
  const platformSuffix = product.isGlobalOnly ? " · Plataforma" : "";
  return `${product.name}${cropSuffix}${platformSuffix}`;
}
