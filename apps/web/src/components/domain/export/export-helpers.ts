import { toast } from "sonner";
import type { RecommendationShareData } from "@recomenda/domain/recommendations/share-message";
import type { PagedResult } from "@/lib/print/paged-document";

/** Textos e contas pequenas do padrão "Exportar" (talhão e safra). */

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

/** dd/mm — a linha da etapa é curta. */
export function shortDate(value: string | null | undefined): string | null {
  const ymd = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return ymd ? `${ymd[3]}/${ymd[2]}` : null;
}

/** "prevista 12/10" / "aplicada 14/10" / "pulada". */
export function stageWhen(rec: RecommendationShareData["recommendations"][number]): string {
  if (rec.status === "SKIPPED") return rec.executed_date ? `pulada ${shortDate(rec.executed_date)}` : "pulada";
  if (APPLIED.has(rec.status) && rec.executed_date) return `aplicada ${shortDate(rec.executed_date)}`;
  const predicted = shortDate(rec.predicted_date_current);
  return predicted ? `prevista ${predicted}` : "sem data";
}

/** Folhas por documento, a partir dos rótulos que a paginação devolve. */
export function pagesByPart(result: PagedResult | null): { report: number; recipes: number } {
  const out = { report: 0, recipes: 0 };
  for (const page of result?.pages ?? []) {
    if (page.label.startsWith("Receita")) out.recipes += 1;
    else out.report += 1;
  }
  return out;
}

export function partsSummary(report: boolean, recipes: boolean, recipeCount: number): string {
  const r = `${recipeCount} ${recipeCount === 1 ? "receita" : "receitas"}`;
  if (report && recipes) return `Resumo + ${r}`;
  if (report) return "Só o resumo";
  if (recipes) return r;
  return "Nenhum documento";
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Texto copiado.");
  } catch {
    toast.error("Não foi possível copiar. Copie o texto manualmente.");
  }
}

export function openWhatsapp(message: string): void {
  // api.whatsapp.com/send evita o redirect do wa.me que corrompe emojis UTF-8.
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`,
    "_blank",
    "noopener,noreferrer",
  );
}


/** Mesma regra de "mesma etapa" do servidor (`stageKey`): sem acento/caixa. */
export function stageKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}
