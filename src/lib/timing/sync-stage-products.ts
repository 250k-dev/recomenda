import {
  createMixTemplate,
  replaceMixTemplateItems,
  updateTimingStage,
  type MixTemplateItem,
} from "@/lib/api/templates";
import type { StageProductDraft } from "@/components/domain/timing/timing-stages-editor";
import type { Product } from "@/lib/api/catalog";

function parseDose(value: string): number {
  return Number(String(value).replace(",", "."));
}

/** Produto "pronto" = tem produto escolhido E dose > 0. Só assim ele é
 *  persistido no mix. Enquanto não estiver pronto (linha vazia, produto sem
 *  dose, dose sem produto), é um rascunho em aberto que o autosave não deve
 *  disparar e a re-hidratação não deve apagar. */
export function isStageProductPersistable(product: StageProductDraft): boolean {
  return Boolean(product.productId) && parseDose(product.dose) > 0;
}

function getValidProducts(products: StageProductDraft[]) {
  return products.filter(isStageProductPersistable);
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
      // Prioriza a categoria vinda do servidor (lookup direto do produto). O
      // catálogo local no cliente é paginado e pode não conter o produto — era
      // por isso que a categoria "sumia" ao recarregar/salvar.
      category: item.category ?? product?.category ?? "OTHER",
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
  // NÃO aborta a etapa toda por causa de uma linha incompleta (produto sem dose).
  // Salva os produtos válidos e apenas ignora os incompletos — que continuam como
  // rascunho na tela. Antes, uma linha zerada bloqueava o save e o produto válido
  // acima nunca era gravado, sumindo na próxima reconciliação com o servidor.
  const validProducts = getValidProducts(products);

  if (validProducts.length === 0) {
    // Sem nenhum produto válido: se ainda há linhas EM ABERTO, o usuário está no
    // meio da edição — não esvazia o mix. Só esvazia quando a etapa fica de fato
    // sem produtos.
    if (hasIncompleteProducts(products)) {
      return currentMixId ?? null;
    }
    if (currentMixId) {
      // Esvazia o mix (1 chamada) e desvincula do estágio.
      await replaceMixTemplateItems(currentMixId, []);
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

  // Dedup por produto (última dose vence) e substitui TODOS os itens numa única
  // requisição. Antes era um GET + 1 request por item (N+1: 200 itens = 200
  // chamadas); agora é 1 chamada, atômica no servidor.
  const byProduct = new Map<
    string,
    { local_product_id: string; dose_per_hectare: number; dose_unit: string }
  >();
  for (const product of validProducts) {
    byProduct.set(product.productId, {
      local_product_id: product.productId,
      dose_per_hectare: parseDose(product.dose),
      dose_unit: product.unit,
    });
  }
  await replaceMixTemplateItems(mixId, [...byProduct.values()]);

  return mixId;
}
