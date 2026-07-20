import type { MixTemplateItem } from "@recomenda/api/templates";
import type { StageProductDraft } from "./types";
import type { Product } from "@recomenda/api/catalog";

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

export type MixItemInput = {
  local_product_id: string;
  dose_per_hectare: number;
  dose_unit: string;
};

/** O que a etapa precisa que aconteça no servidor. Decidir isto é lógica de
 *  negócio (mora aqui); executar é transporte (mora em quem tem acesso à rede). */
export type StageProductsPlan =
  /** Nada a persistir e nada a limpar — o mix atual, se houver, fica como está. */
  | { kind: "keep"; mixId: string | null }
  /** A etapa ficou de fato sem produtos: esvazia o mix e desvincula do estágio. */
  | { kind: "clear"; mixId: string }
  /** Há produtos válidos: cria o mix se ainda não existir e substitui os itens. */
  | {
      kind: "sync";
      /** `null` = ainda não existe mix; quem executa precisa criar um. */
      mixId: string | null;
      /** Nome do mix a criar, usado só quando `mixId` é `null`. */
      newMixName: string;
      crop: string;
      items: MixItemInput[];
    };

/**
 * Decide, sem tocar na rede, o que fazer com os produtos de uma etapa.
 *
 * Era `syncStageProducts`, que importava os fetchers e disparava as chamadas
 * daqui — o único dos 14 pontos `domain → api` que importava valores em vez de
 * tipos, contra `00-arquitetura.md:101` ("lógica de negócio pura"). A execução
 * saiu para `apps/web` (`apply-stage-products-plan.ts`); o que decide ficou.
 */
export function planStageProducts({
  stageName,
  templateName,
  crop,
  currentMixId,
  products,
}: {
  stageName: string;
  templateName: string;
  crop: string;
  currentMixId?: string | null;
  products: StageProductDraft[];
}): StageProductsPlan {
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
      return { kind: "keep", mixId: currentMixId ?? null };
    }
    if (currentMixId) {
      return { kind: "clear", mixId: currentMixId };
    }
    return { kind: "keep", mixId: null };
  }

  // Dedup por produto (última dose vence) para substituir TODOS os itens numa
  // única requisição. Antes era um GET + 1 request por item (N+1: 200 itens =
  // 200 chamadas); agora é 1 chamada, atômica no servidor.
  const byProduct = new Map<string, MixItemInput>();
  for (const product of validProducts) {
    byProduct.set(product.productId, {
      local_product_id: product.productId,
      dose_per_hectare: parseDose(product.dose),
      dose_unit: product.unit,
    });
  }

  return {
    kind: "sync",
    mixId: currentMixId ?? null,
    newMixName: `${stageName} — ${templateName}`,
    crop,
    items: [...byProduct.values()],
  };
}
