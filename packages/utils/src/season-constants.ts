export const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
  BEAN: "Feijão",
  /** Modelos e listas que valem para qualquer cultura. */
  ANY: "Todas as culturas",
};

/** Culturas que uma safra pode ter. Cultura nova entra aqui junto com a regra
 *  de cálculo da semente dela. */
export const CROP_OPTIONS = [
  { value: "SOYBEAN", label: "Soja" },
  { value: "CORN", label: "Milho" },
  { value: "BEAN", label: "Feijão" },
] as const;

export type CycleCrop = (typeof CROP_OPTIONS)[number]["value"];

/** Nome da cultura para a tela. */
export function cropLabel(crop: string | null | undefined): string {
  if (!crop) return "";
  return CROP_LABELS[crop] ?? crop;
}

/** Culturas da safra juntas: "Soja + Feijão". */
export function cropsLabel(crops: string[] | null | undefined): string {
  return (crops ?? []).map((c) => cropLabel(c)).join(" + ");
}

/**
 * Cultura gravada em modelo/lista a partir de várias escolhidas: uma só vira
 * ela mesma; duas ou mais viram ANY ("Todas as culturas").
 */
export function cropFromSelection(selected: string[]): string | null {
  const unique = [...new Set(selected)];
  if (unique.length === 0) return null;
  return unique.length === 1 ? unique[0] : "ANY";
}

/** Status da programação do talhão (`seasons.status`). */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

/** Status da safra (`crop_cycles.status`). */
export const CYCLE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

/** Status da lista de compra (`purchase_lists.status`). */
export const PURCHASE_LIST_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Finalizada",
};

export const STATUS_VARIANTS: Record<
  string,
  "default" | "neutral" | "info" | "success"
> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  HARVESTED: "success",
  ARCHIVED: "neutral",
  ACTIVE: "success",
};

/** Traduz enum do servidor para label PT (aceita caixa mista). */
export function labelStatus(
  labels: Record<string, string>,
  status: string | null | undefined,
  fallback = "—",
): string {
  if (!status) return fallback;
  return (
    labels[status] ??
    labels[status.toUpperCase()] ??
    labels[status.toLowerCase()] ??
    fallback
  );
}
