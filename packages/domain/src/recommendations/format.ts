import type { Recommendation } from "@recomenda/api";

/** Display status incluindo o estado derivado "OVERDUE" (atrasado). */
export type RecommendationDisplayStatus =
  | "PENDING"
  | "OVERDUE"
  | "APPLIED_ON_TIME"
  | "APPLIED_LATE"
  | "SKIPPED";

export const RECOMMENDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  OVERDUE: "Atrasado",
  APPLIED_ON_TIME: "Aplicado no prazo",
  APPLIED_LATE: "Aplicado com atraso",
  SKIPPED: "Pulada",
};

export function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Dessecação é sempre manual — nunca marca atraso automático (item 23). */
export function isDesiccationRec(rec: { name: string }): boolean {
  return /dessec/i.test(rec.name);
}

/**
 * Status exibido: uma etapa PENDENTE cuja janela já passou vira "Atrasado",
 * exceto dessecação (sempre manual). Demais status são mantidos.
 */
export function displayRecStatus(rec: {
  status: string;
  name: string;
  predicted_date_current: string | null;
  window_start_days: number;
  window_end_days: number;
}): RecommendationDisplayStatus {
  if (rec.status !== "PENDING") return rec.status as RecommendationDisplayStatus;
  if (isDesiccationRec(rec)) return "PENDING";
  if (!rec.predicted_date_current) return "PENDING";
  // Janela centrada na data prevista (data ± metade do span). Atrasada quando
  // hoje passa do FIM da janela (data + metade do span).
  const halfWindow = Math.round((rec.window_end_days - rec.window_start_days) / 2);
  const deadline = new Date(rec.predicted_date_current + "T12:00:00");
  deadline.setDate(deadline.getDate() + halfWindow);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today.getTime() > deadline.getTime() ? "OVERDUE" : "PENDING";
}

export function recommendationStatusLabel(rec: Recommendation): string {
  const status = displayRecStatus(rec);
  return RECOMMENDATION_STATUS_LABELS[status] ?? status;
}
