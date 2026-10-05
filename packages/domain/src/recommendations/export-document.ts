import { htmlShell } from "../print/print-core";
import { REC_CSS, reportParts, type DocumentCover } from "./print-document";
import { RECIPE_CSS, recipeSheets } from "./recipe-document";
import type { RecommendationShareData } from "./share-message";

/**
 * PDF unificado do "Exportar": um arquivo só, por talhão — o relatório
 * (resumo e cronograma, com custos se marcado) na frente e as receitas de
 * aplicação (uma folha por etapa, para o operador) atrás. Dá para tirar
 * qualquer uma das duas partes.
 */
export interface ExportDocumentOptions {
  /** Resumo e cronograma do talhão (o antigo "Baixar PDF"). */
  report: boolean;
  /** Receitas de aplicação (uma folha por etapa × talhão). */
  recipes: boolean;
  /** Preços e custos — só no relatório (a receita nunca leva preço). */
  showPrices?: boolean;
  /** Capa da safra/fazenda (só com o relatório). */
  cover?: DocumentCover | null;
}

export function buildExportHtml(
  list: RecommendationShareData[],
  title: string,
  options: ExportDocumentOptions,
): string {
  const parts = options.report
    ? reportParts(list, { showPrices: options.showPrices, cover: options.cover })
    : null;
  const chunks: string[] = [];
  if (parts?.cover) chunks.push(parts.cover);
  for (const data of list) {
    if (parts) chunks.push(parts.body(data, chunks.length > 0));
    if (options.recipes) chunks.push(...recipeSheets(data, chunks.length > 0));
  }
  return htmlShell(title, chunks.join(""), REC_CSS + RECIPE_CSS);
}
