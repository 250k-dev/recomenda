import { toast } from "sonner";
import { buildApplicationRecipesWhatsappMessage } from "@recomenda/domain/recommendations/recipe-document";
import {
  buildMultiWhatsappMessage,
  buildWhatsappMessage,
  type RecommendationShareData,
} from "@recomenda/domain/recommendations/share-message";

const WA_PART_DIVIDER = "————————————————";

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

/** WhatsApp do exportar: resumo da visão geral e as receitas do operador. */
export function composeRecommendationExportWhatsappMessage(opts: {
  single?: RecommendationShareData;
  multi?: {
    farmName?: string | null;
    datas: RecommendationShareData[];
    contextLabel?: string;
  };
}): string {
  const parts: string[] = [];
  if (opts.single) parts.push(buildWhatsappMessage(opts.single));
  else if (opts.multi) {
    parts.push(
      buildMultiWhatsappMessage(
        opts.multi.farmName,
        opts.multi.datas,
        opts.multi.contextLabel,
      ),
    );
  }
  const datas = opts.single ? [opts.single] : opts.multi?.datas ?? [];
  const recipesText = buildApplicationRecipesWhatsappMessage(datas);
  if (recipesText) parts.push(recipesText);
  return parts.join(`\n\n${WA_PART_DIVIDER}\n\n`);
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

type RecipeLike = {
  spray_volume_l_ha?: number | string | null;
  tank_capacity_l?: number | string | null;
  application_time?: string | null;
  nozzle?: string | null;
  phenological_stage?: string | null;
};

/** Compara os cinco campos da receita de aplicação (normalizados). */
export function applicationRecipeFingerprint(source: RecipeLike): string {
  const num = (v: number | string | null | undefined) => {
    if (v == null || v === "") return "";
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  };
  return JSON.stringify({
    spray_volume_l_ha: num(source.spray_volume_l_ha),
    tank_capacity_l: num(source.tank_capacity_l),
    application_time: (source.application_time ?? "").trim(),
    nozzle: (source.nozzle ?? "").trim(),
    phenological_stage: (source.phenological_stage ?? "").trim(),
  });
}

export function hasApplicationRecipeData(source: RecipeLike): boolean {
  const fp = applicationRecipeFingerprint(source);
  return fp !== JSON.stringify({
    spray_volume_l_ha: "",
    tank_capacity_l: "",
    application_time: "",
    nozzle: "",
    phenological_stage: "",
  });
}

/** Qualquer campo de receita vindo da API (antes da normalização). */
export function rowHasStoredRecipeFields(row: RecipeLike): boolean {
  if (hasApplicationRecipeData(row)) return true;
  const text = (v: string | null | undefined) => Boolean(v?.trim());
  return (
    (row.spray_volume_l_ha != null && row.spray_volume_l_ha !== "") ||
    (row.tank_capacity_l != null && row.tank_capacity_l !== "") ||
    text(row.application_time) ||
    text(row.nozzle) ||
    text(row.phenological_stage)
  );
}
