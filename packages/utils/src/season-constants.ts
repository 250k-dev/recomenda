export const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
  ANY: "Soja e Milho",
};

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
