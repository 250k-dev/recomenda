export const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
  ANY: "Soja e Milho",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
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
};
