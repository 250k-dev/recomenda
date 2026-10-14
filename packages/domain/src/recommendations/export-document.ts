import { buildUnifiedExportHtml } from "./unified-export-document";
import type { RecommendationShareData } from "./share-message";

/**
 * PDF do "Exportar": um arquivo só. A visão geral (resumo, cronograma e
 * compra) vem na frente; cada aplicação vira uma receita atrás.
 * Preço, se marcado, entra só na visão geral.
 */
export interface ExportDocumentOptions {
  showPrices?: boolean;
}

export function buildExportHtml(
  list: RecommendationShareData[],
  title: string,
  options: ExportDocumentOptions = {},
): string {
  return buildUnifiedExportHtml(list, title, { showPrices: options.showPrices });
}
