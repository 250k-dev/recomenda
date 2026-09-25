import type { Recommendation, RecommendationItem } from "@recomenda/api";
import { DOSE_UNIT_SHORT_LABELS } from "@recomenda/utils";
import { displayRecStatus, fmtDate } from "./format";
import { sortRecommendationItemsByMixOrder } from "./mix-order";

/** Uma variedade do talhão, com a área que ocupa e a população desejada. */
export interface ShareVariety {
  variety: string;
  plantedAreaHa?: number | null;
  thousandPlantsPerHa?: number | null;
}

/**
 * Ficha técnica do talhão no documento. Todo campo é opcional porque o
 * agrônomo preenche pouco: o que faltar sai como "—" no PDF, para deixar
 * visível que ali deveria haver informação.
 */
export interface SharePlotSpec {
  farmName?: string | null;
  farmLocation?: string | null;
  cycleName?: string | null;
  cropLabel?: string | null;
  /** Área cadastral do talhão. */
  areaHa?: number | null;
  plantedAreaHa?: number | null;
  varieties?: ShareVariety[];
  /** Espaçamento entre linhas (m) — vem da lista de compra da safra. */
  spacingM?: number | null;
  cycleDays?: number | null;
  desiccationDate?: string | null;
}

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
  /** Ficha técnica; ausente = documento sem o bloco (compat com chamadas antigas). */
  spec?: SharePlotSpec | null;
  /**
   * Preço unitário em R$ por `local_product_id`, vindo da lista de compra da
   * safra (`unit_price_brl`). O custo do documento é sempre
   * `preço unitário × dose DA RECOMENDAÇÃO` — nunca o custo já calculado na
   * lista, que pode estar em outra dose.
   */
  unitPriceByProduct?: Record<string, number>;
}

// Divisor em travessões: renderiza igual em qualquer cliente (inclusive no
// prefill do link wa.me), ao contrário de caracteres de box-drawing.
const DIVIDER = "————————————————";
/** Divisor curto entre etapas do mesmo talhão (o longo separa talhões). */
const STAGE_DIVIDER = "———";

/** Número pt-BR sem zeros sobrando: 227,5 / 0,05 / 1.840. */
function fmtNum(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

/** Data numérica (dd/mm/aaaa) — mais curta que a por extenso no WhatsApp. */
function fmtDateNumeric(d: string): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return ymd ? `${ymd[3]}/${ymd[2]}/${ymd[1]}` : fmtDate(d);
}

function unitLabel(unit: string): string {
  return (DOSE_UNIT_SHORT_LABELS as Record<string, string>)[unit] ?? unit;
}

/** Área de referência do talhão: plantada, senão a cadastral. */
function plotAreaHa(data: RecommendationShareData): number | null {
  const area = data.spec?.plantedAreaHa ?? data.spec?.areaHa;
  return typeof area === "number" && area > 0 ? area : null;
}

function formatProduct(item: RecommendationItem, areaHa: number | null): string {
  const unit = unitLabel(item.dose_unit);
  // Unidade que já é por hectare (t/ha) não ganha outro "/ha"; no total, sai o "/ha".
  const perHa = unit.endsWith("/ha");
  const totalUnit = perHa ? unit.slice(0, -3) : unit;

  const lines = [`_${item.product_name}_`];
  if (item.mapa_registration) {
    lines.push(`Número de registro: ${item.mapa_registration}`);
  }
  if (item.dose_per_hectare > 0) {
    lines.push(`Dosagem: ${fmtNum(item.dose_per_hectare, 3)} ${perHa ? unit : `${unit}/ha`}`);
  }
  const factor = item.area_factor ?? 1;
  if (factor > 0 && factor < 1) {
    const pct = `${fmtNum(factor * 100, 0)}%`;
    const ha = areaHa != null ? ` (${fmtNum(areaHa * factor)} ha)` : "";
    lines.push(`Área aplicada: ${pct} da área${ha}`);
  }
  if (item.area_note) lines.push(`Obs.: ${item.area_note}`);
  if (item.total_quantity > 0) {
    lines.push(`Quantidade total: ${fmtNum(item.total_quantity)} ${totalUnit}`);
  }
  return lines.join("\n");
}

/** Linha de data da etapa: prevista, aplicada (✅), atrasada (⚠️) ou pulada. */
function formatStageDate(rec: Recommendation): string | null {
  const status = displayRecStatus(rec);
  if (rec.executed_date) {
    const icon = status === "SKIPPED" ? "" : " ✅";
    const label = status === "SKIPPED" ? "Pulada em" : "Aplicado em";
    return `*${label}:* ${fmtDateNumeric(rec.executed_date)}${icon}`;
  }
  if (status === "SKIPPED") return "*Status:* Pulada";
  const late = status === "OVERDUE" ? " ⚠️ Atrasada" : "";
  if (rec.predicted_date_current) {
    return `*Data prevista:* ${fmtDateNumeric(rec.predicted_date_current)}${late}`;
  }
  return late ? `*Status:*${late}` : null;
}

function formatProducts(rec: Recommendation, areaHa: number | null): string {
  if (rec.items.length === 0) return "*Produtos:*\n_Sem produtos vinculados._";
  const blocks = sortRecommendationItemsByMixOrder(rec.items).map((item) =>
    formatProduct(item, areaHa),
  );
  return `*Produtos:*\n${blocks.join("\n\n")}`;
}

function formatComments(rec: Recommendation): string | null {
  const notes = rec.notes?.trim();
  return notes ? `*Comentários*\n${notes}` : null;
}

/** Cultura / talhão / área / produtor — rótulos em negrito, um por linha. */
function seasonInfoLines(data: RecommendationShareData): string[] {
  const areaHa = plotAreaHa(data);
  const lines: string[] = [];
  if (data.spec?.cropLabel) lines.push(`*Cultura:* ${data.spec.cropLabel}`);
  if (data.plotName) lines.push(`*Talhão:* ${data.plotName}`);
  if (areaHa != null) lines.push(`*Área total:* ${fmtNum(areaHa)} ha`);
  if (data.producerName) lines.push(`*Produtor:* ${data.producerName}`);
  return lines;
}

/**
 * Corpo de um talhão, sem rodapé. Com uma etapa só, segue o formato de
 * prescrição (título da etapa → data → dados do talhão → produtos); com
 * várias, os dados do talhão saem uma vez e cada etapa vira um bloco.
 */
function buildPlotSection(
  data: RecommendationShareData,
  opts: { showFarm: boolean },
): string {
  const areaHa = plotAreaHa(data);
  const farm =
    opts.showFarm && data.spec?.farmName
      ? `*FAZENDA ${data.spec.farmName.toUpperCase()}*`
      : null;
  const info = seasonInfoLines(data);

  if (data.recommendations.length === 0) {
    return [farm, info.join("\n"), "_Nenhuma etapa cadastrada nesta safra._"]
      .filter(Boolean)
      .join("\n\n");
  }

  if (data.recommendations.length === 1) {
    const rec = data.recommendations[0];
    const date = formatStageDate(rec);
    return [
      farm,
      `*${rec.name.toUpperCase()}*`,
      [date, ...info].filter(Boolean).join("\n"),
      formatProducts(rec, areaHa),
      formatComments(rec),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const stages = data.recommendations.map((rec) => {
    const date = formatStageDate(rec);
    const head = [`*${rec.name.toUpperCase()}*`, date].filter(Boolean).join("\n");
    return [head, formatProducts(rec, areaHa), formatComments(rec)]
      .filter(Boolean)
      .join("\n\n");
  });

  return [farm, info.join("\n"), ...stages.map((s) => `${STAGE_DIVIDER}\n\n${s}`)]
    .filter(Boolean)
    .join("\n\n");
}

function buildFooter(agronomistName?: string | null): string {
  const lines: string[] = [];
  if (agronomistName) lines.push(`_Responsável técnico: ${agronomistName}_`);
  lines.push("_Enviado pelo Recomenda 250K_");
  return lines.join("\n");
}

/**
 * Mensagem da recomendação no formato de prescrição (inspirado no Cropwise):
 * rótulos em *negrito*, um bloco por produto com dose, quantidade total e
 * registro MAPA, e comentários no fim. Emoji só para aplicada (✅) e
 * atrasada (⚠️) — o cliente achava a versão cheia de emojis poluída.
 */
export function buildWhatsappMessage(data: RecommendationShareData): string {
  return [
    buildPlotSection(data, { showFarm: true }),
    buildFooter(data.agronomistName),
  ].join("\n\n");
}

/**
 * Mensagem com vários talhões: título do contexto uma vez e cada talhão como
 * seção separada por divisor. O nome da fazenda só se repete na seção quando o
 * contexto não é a própria fazenda (ex.: safra com várias fazendas).
 */
export function buildMultiWhatsappMessage(
  farmName: string | null | undefined,
  items: RecommendationShareData[],
  contextLabel = "FAZENDA",
): string {
  const isFarmContext = contextLabel === "FAZENDA";
  const sections = items.map((it) =>
    buildPlotSection(it, { showFarm: !isFarmContext || !farmName }),
  );
  const footer = buildFooter(items.find((it) => it.agronomistName)?.agronomistName);
  const header = farmName
    ? `*${contextLabel} ${farmName.toUpperCase()}*\n${items.length} ${items.length === 1 ? "talhão" : "talhões"}`
    : null;
  return [header, ...sections, footer]
    .filter(Boolean)
    .join(`\n\n${DIVIDER}\n\n`);
}
