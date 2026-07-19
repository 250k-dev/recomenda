import type { Recommendation } from "@recomenda/api";
import { displayRecStatus, fmtDate, recommendationStatusLabel } from "./format";
import type { RecommendationShareData } from "./share-message";
import {
  escapeHtml,
  footerHtml,
  headerHtml,
  htmlShell,
  printHtml,
} from "../print/print-core";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "is-pending",
  OVERDUE: "is-overdue",
  APPLIED_ON_TIME: "is-done",
  APPLIED_LATE: "is-late",
  SKIPPED: "is-skipped",
};

function fmtQty(value: number, unit: string): string {
  if (value <= 0) return "&mdash;";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${escapeHtml(unit)}`;
}

function productRowsHtml(rec: Recommendation): string {
  if (rec.items.length === 0) {
    return `<p class="empty">Nenhum produto vinculado a esta etapa.</p>`;
  }
  const rows = rec.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product_name)}${
            item.is_substitution ? `<span class="sub"> (substituído)</span>` : ""
          }</td>
          <td class="num">${item.dose_per_hectare} ${escapeHtml(item.dose_unit)}</td>
          <td class="num">${fmtQty(item.total_quantity, item.dose_unit)}</td>
        </tr>`,
    )
    .join("");
  return `
    <table class="products">
      <thead>
        <tr><th>Produto</th><th class="num">Dose/ha</th><th class="num">Quantidade total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function stageHtml(rec: Recommendation, index: number): string {
  const status = displayRecStatus(rec);
  const statusClass = STATUS_CLASS[status] ?? "is-pending";
  const dates: string[] = [];
  if (rec.predicted_date_current) {
    dates.push(`Previsto: ${escapeHtml(fmtDate(rec.predicted_date_current))}`);
  }
  if (rec.executed_date) {
    dates.push(`Aplicado: ${escapeHtml(fmtDate(rec.executed_date))}`);
  }
  return `
    <div class="stage">
      <div class="stage-head">
        <span class="stage-num">${index + 1}</span>
        <span class="stage-name">${escapeHtml(rec.name)}</span>
        <span class="status ${statusClass}">${escapeHtml(recommendationStatusLabel(rec))}</span>
      </div>
      ${dates.length ? `<div class="stage-dates">${dates.map((d) => `<span>${d}</span>`).join("")}</div>` : ""}
      ${productRowsHtml(rec)}
      ${rec.notes ? `<p class="notes">Observações: ${escapeHtml(rec.notes)}</p>` : ""}
    </div>`;
}

/** CSS específico da recomendação (etapas/produtos/status). O genérico
 *  (cabeçalho, título, resumo, rodapé) vem do CORE_CSS em print-core. */
const REC_CSS = `
  .stage { border: 1px solid #e2e0d6; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
  .stage-head { display: flex; align-items: center; gap: 10px; }
  .stage-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: #2f6d3f; color: #ffffff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .stage-name { font-size: 14px; font-weight: 600; color: #20201c; flex: 1; }
  .status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 999px; padding: 2px 9px; border: 1px solid #d8d6cc; color: #4a4a42; background: #f1f0ea; white-space: nowrap; }
  .status.is-overdue, .status.is-late { background: #fdf0e3; border-color: #f0d4ab; color: #9a5a16; }
  .status.is-done { background: #e8f3ea; border-color: #bcdcc3; color: #2f6d3f; }
  .status.is-skipped { background: #f6ece6; border-color: #e6cdbe; color: #94572f; }
  .stage-dates { display: flex; flex-wrap: wrap; gap: 14px; margin: 8px 0 10px 32px; font-size: 11px; color: #6b6b62; }
  .products { width: calc(100% - 32px); margin-left: 32px; border-collapse: collapse; font-size: 11px; }
  .products th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #7a7a70; padding: 4px 8px; border-bottom: 1px solid #e2e0d6; }
  .products td { padding: 5px 8px; border-bottom: 1px solid #efeee8; color: #2b2b27; }
  .products .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sub { font-size: 10px; color: #9a5a16; }
  .notes { margin: 10px 0 0 32px; font-size: 11px; color: #4a4a42; font-style: italic; }
  .empty { font-size: 11px; color: #7a7a70; margin: 0 0 0 32px; }
`;

/** Monta o documento HTML completo da recomendação, populado pelos dados. */
/** Corpo (`.doc`) de um talhão — reutilizado no documento simples e no multi. */
function buildDocBody(data: RecommendationShareData, pageBreak = false): string {
  const progressPct =
    data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
  const emittedAt = fmtDate(new Date().toISOString().slice(0, 10));

  const tags: string[] = [];
  if (data.plotName) tags.push(`<span>Talhão ${escapeHtml(data.plotName)}</span>`);
  if (data.producerName)
    tags.push(`<span>Produtor: ${escapeHtml(data.producerName)}</span>`);

  const summary: string[] = [];
  if (data.plantingDate) {
    summary.push(`
      <div class="summary-item">
        <span class="summary-label">Plantio</span>
        <span class="summary-value">${escapeHtml(fmtDate(data.plantingDate))}</span>
      </div>`);
  }
  if (data.statusLabel) {
    summary.push(`
      <div class="summary-item">
        <span class="summary-label">Status da safra</span>
        <span class="summary-value">${escapeHtml(data.statusLabel)}</span>
      </div>`);
  }
  summary.push(`
    <div class="summary-item">
      <span class="summary-label">Progresso</span>
      <span class="summary-value">${data.done}/${data.total} aplicadas (${progressPct}%)</span>
    </div>`);

  const stages =
    data.recommendations.length > 0
      ? data.recommendations.map((rec, index) => stageHtml(rec, index)).join("")
      : `<p class="empty" style="margin-left:0">Nenhuma etapa cadastrada nesta safra.</p>`;

  return `
  <div class="doc"${pageBreak ? ' style="page-break-before: always"' : ""}>
    ${headerHtml(emittedAt)}
    <div class="title-block">
      <p class="kicker">Recomendação agronômica</p>
      <h1 class="title">${escapeHtml(data.title)}</h1>
      ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
    </div>
    <div class="summary">${summary.join("")}</div>
    <section>
      <h2 class="section-title">Cronograma de aplicações</h2>
      ${stages}
    </section>
    ${footerHtml(data.agronomistName)}
  </div>`;
}

export function buildRecommendationHtml(data: RecommendationShareData): string {
  return htmlShell(`Recomendação - ${data.title}`, buildDocBody(data), REC_CSS);
}

/** Documento com vários talhões (um por página). */
export function buildRecommendationsHtml(
  list: RecommendationShareData[],
  title: string,
): string {
  const body = list.map((d, i) => buildDocBody(d, i > 0)).join("");
  return htmlShell(title, body, REC_CSS);
}

/**
 * Imprime a recomendação num iframe isolado (com CSS próprio), sem capturar a
 * UI do app. O navegador usa o <title> como nome padrão ao "Salvar como PDF".
 */
export function printRecommendation(data: RecommendationShareData): void {
  printHtml(buildRecommendationHtml(data));
}

/** Imprime vários talhões num único PDF (um por página). */
export function printRecommendations(
  list: RecommendationShareData[],
  title = "Recomendações",
): void {
  if (list.length === 0) return;
  printHtml(buildRecommendationsHtml(list, title));
}
