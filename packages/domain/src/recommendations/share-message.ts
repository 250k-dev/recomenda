import type { Recommendation, RecommendationItem } from "@recomenda/api";
import { displayRecStatus, fmtDate, RECOMMENDATION_STATUS_LABELS } from "./format";
import {
  formulationShortLabel,
  resolveFormulationKey,
} from "./formulation-mix-order";
import { sortRecommendationItemsByMixOrder } from "./mix-order";

export interface RecommendationShareData {
  title: string;
  plotName?: string | null;
  plantingDate?: string | null;
  statusLabel?: string | null;
  producerName?: string | null;
  agronomistName?: string | null;
  done: number;
  total: number;
  recommendations: Recommendation[];
}

const STATUS_EMOJI: Record<string, string> = {
  PENDING: "⏳",
  OVERDUE: "⚠️",
  APPLIED_ON_TIME: "✅",
  APPLIED_LATE: "🟡",
  SKIPPED: "⏭️",
};

// Divisor em travessões: renderiza igual em qualquer cliente (inclusive no
// prefill do link wa.me), ao contrário de caracteres de box-drawing.
const DIVIDER = "————————————————";

function itemFormulationShort(item: RecommendationItem): string {
  const key =
    item.formulation_key ?? resolveFormulationKey(item.equivalence_group);
  return formulationShortLabel(key);
}

function formatDose(item: RecommendationItem): string {
  const short = itemFormulationShort(item);
  const formSuffix = short !== "—" ? ` (${short})` : "";
  const dose =
    item.dose_per_hectare > 0
      ? `: ${item.dose_per_hectare} ${item.dose_unit}/ha`
      : "";
  return `   • ${item.product_name}${formSuffix}${dose}`;
}

function formatStage(rec: Recommendation, index: number): string {
  const status = displayRecStatus(rec);
  const statusLabel = RECOMMENDATION_STATUS_LABELS[status] ?? status;
  const emoji = STATUS_EMOJI[status] ?? "•";

  const lines: string[] = [`*${index + 1}. ${rec.name}* ${emoji} ${statusLabel}`];

  if (rec.executed_date) {
    lines.push(`🗓️ Aplicado em ${fmtDate(rec.executed_date)}`);
  } else if (rec.predicted_date_current) {
    lines.push(`🗓️ Previsto para ${fmtDate(rec.predicted_date_current)}`);
  }

  if (rec.items.length > 0) {
    lines.push(...sortRecommendationItemsByMixOrder(rec.items).map(formatDose));
  } else {
    lines.push("   • (sem produtos vinculados)");
  }

  if (rec.notes) {
    lines.push(`📝 ${rec.notes}`);
  }

  return lines.join("\n");
}

/**
 * Constrói a mensagem da recomendação com markdown do WhatsApp (*negrito*),
 * emojis, status, datas e doses por produto.
 *
 * Observação: alguns clientes corrompem emojis quando o texto chega via prefill
 * do link wa.me. Por isso o envio no WhatsApp copia esta mensagem para a área
 * de transferência (caminho que preserva os emojis) antes de abrir o app.
 */
export function buildWhatsappMessage(data: RecommendationShareData): string {
  const progressPct =
    data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  const header: string[] = [
    "🌱 *RECOMENDAÇÃO AGRONÔMICA*",
    "",
    `*${data.title}*`,
  ];

  if (data.plotName) header.push(`📍 Talhão: ${data.plotName}`);
  if (data.producerName) header.push(`👤 Produtor: ${data.producerName}`);
  if (data.plantingDate) header.push(`🌾 Plantio: ${fmtDate(data.plantingDate)}`);
  header.push(
    `📊 Progresso: ${data.done}/${data.total} aplicadas (${progressPct}%)`,
  );

  const body =
    data.recommendations.length > 0
      ? [
          "📋 *CRONOGRAMA DE APLICAÇÕES*",
          // Linha em branco entre cada etapa para legibilidade no WhatsApp.
          data.recommendations
            .map((rec, index) => formatStage(rec, index))
            .join("\n\n"),
        ]
      : ["_Nenhuma etapa cadastrada nesta safra._"];

  const footer: string[] = [DIVIDER];
  if (data.agronomistName) {
    footer.push(`👨‍🌾 Responsável técnico: ${data.agronomistName}`);
  }
  footer.push("_Enviado via Recomenda_");

  // Blocos separados por linha em branco.
  return [header.join("\n"), body.join("\n\n"), footer.join("\n")].join("\n\n");
}

/**
 * Mensagem com vários talhões: um cabeçalho do contexto + a recomendação de cada
 * talhão selecionado, separadas por divisor. Reaproveita buildWhatsappMessage.
 */
export function buildMultiWhatsappMessage(
  farmName: string | null | undefined,
  items: RecommendationShareData[],
  contextLabel = "FAZENDA",
): string {
  const sections = items.map((it) => buildWhatsappMessage(it));
  if (!farmName) return sections.join(`\n\n${DIVIDER}\n\n`);
  const header = `🚜 *${contextLabel}: ${farmName}*\n${items.length} ${items.length === 1 ? "talhão" : "talhões"}`;
  return [header, ...sections].join(`\n\n${DIVIDER}\n\n`);
}
