export const CROP_LABELS: Record<string, string> = {
  SOYBEAN: "Soja",
  CORN: "Milho",
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
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  HARVESTED: "outline",
  ARCHIVED: "secondary",
};
