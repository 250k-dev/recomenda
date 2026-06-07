import {
  createMixTemplate,
  createMixTemplateItem,
  deleteMixTemplateItem,
  getMixTemplate,
  updateMixTemplateItem,
  updateTimingStage,
  type MixTemplateItem,
} from "@/lib/api/templates";
import type { StageProductDraft } from "@/components/domain/timing/timing-stages-editor";
import type { Product } from "@/lib/api/catalog";

function parseDose(value: string): number {
  return Number(String(value).replace(",", "."));
}

function getValidProducts(products: StageProductDraft[]) {
  return products.filter(
    (product) => product.productId && parseDose(product.dose) > 0,
  );
}

function hasIncompleteProducts(products: StageProductDraft[]) {
  return products.some((product) => {
    const hasProduct = Boolean(product.productId);
    const hasDose = parseDose(product.dose) > 0;
    return (hasProduct && !hasDose) || (!hasProduct && hasDose);
  });
}

export function mapMixItemsToStageProducts(
  items: MixTemplateItem[],
  catalog: Product[] = [],
): StageProductDraft[] {
  return items.map((item) => {
    const product = catalog.find((entry) => entry.id === item.local_product_id);
    return {
      key: item.id,
      mixItemId: item.id,
      category: product?.category ?? "OTHER",
      productId: item.local_product_id,
      productName: item.product_name ?? product?.name ?? "",
      dose: String(item.dose_per_hectare),
      unit: item.dose_unit ?? product?.dose_unit ?? "L",
    };
  });
}

export async function syncStageProducts({
  stageId,
  stageName,
  templateName,
  crop,
  currentMixId,
  products,
}: {
  stageId: string;
  stageName: string;
  templateName: string;
  crop: string;
  currentMixId?: string | null;
  products: StageProductDraft[];
}) {
  if (hasIncompleteProducts(products)) {
    return currentMixId ?? null;
  }

  const validProducts = getValidProducts(products);

  if (validProducts.length === 0) {
    if (currentMixId) {
      await updateTimingStage(stageId, { default_mix_template_id: null });
    }
    return null;
  }

  let mixId = currentMixId ?? null;
  if (!mixId) {
    const mix = await createMixTemplate({
      name: `${stageName} — ${templateName}`,
      crop,
    });
    mixId = mix.id;
    await updateTimingStage(stageId, { default_mix_template_id: mixId });
  }

  const existingMix = await getMixTemplate(mixId);
  const existingItems = existingMix?.items ?? [];
  const existingByProductId = new Map(
    existingItems.map((item) => [item.local_product_id, item]),
  );
  const seenProductIds = new Set<string>();

  for (const product of validProducts) {
    const dose = parseDose(product.dose);
    seenProductIds.add(product.productId);
    const existing = existingByProductId.get(product.productId);

    if (existing) {
      const unit = product.unit || existing.dose_unit || "L";
      if (existing.dose_per_hectare !== dose || (existing.dose_unit ?? "L") !== unit) {
        await updateMixTemplateItem(existing.id, {
          dose_per_hectare: dose,
          dose_unit: unit,
        });
      }
      continue;
    }

    await createMixTemplateItem(mixId, {
      local_product_id: product.productId,
      dose_per_hectare: dose,
      dose_unit: product.unit,
    });
  }

  for (const item of existingItems) {
    if (!seenProductIds.has(item.local_product_id)) {
      await deleteMixTemplateItem(item.id);
    }
  }

  return mixId;
}
