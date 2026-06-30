import type { Recommendation } from "@/lib/api/client";
import { displayRecStatus, fmtDate, recommendationStatusLabel } from "./format";
import type { RecommendationShareData } from "./share-message";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "is-pending",
  OVERDUE: "is-overdue",
  APPLIED_ON_TIME: "is-done",
  APPLIED_LATE: "is-late",
  SKIPPED: "is-skipped",
};

/** Logo Recomenda em verde, embutido para não depender de assets externos. */
const LOGO_SVG = `<svg width="24" height="31" viewBox="0 0 95 121" fill="#2f6d3f" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill-rule="evenodd" d="m36.803 17.85 6.985-6.987 4.904 4.905a27.1 27.1 0 0 1 3.984-8.744L46.97 1.318a4.5 4.5 0 0 0-6.195-.16l-.168.16L30.44 11.485a33.167 33.167 0 0 0-7.206 10.793l-.304.76a33.377 33.377 0 0 0-2.23 11.957v.007c0 3.293.49 6.559 1.446 9.694l-12.95-3.463a4.5 4.5 0 0 0-5.445 2.96l-.065.222-2.526 9.427h-.001c-4.828 18.029 5.872 36.55 23.89 41.39 4.747 1.276 9.492 2.547 14.24 3.816v17.115a4.5 4.5 0 0 0 9 0V99.047c4.744-1.269 9.492-2.538 14.24-3.815h-.001c18.024-4.84 28.724-23.362 23.896-41.39l-1.585-5.915a27.163 27.163 0 0 1-9.757 1.8 27.13 27.13 0 0 1-18.41-7.165 24.185 24.185 0 0 1-5.898 9.592 4.568 4.568 0 0 0-.195.208 33.856 33.856 0 0 0-6.79 8.29 33.854 33.854 0 0 0-6.794-8.294 4.58 4.58 0 0 0-.192-.204 24.234 24.234 0 0 1-5.254-7.866 24.263 24.263 0 0 1-1.85-9.28c.005-3.188.631-6.343 1.85-9.287l.003-.005c1.213-2.94 3-5.616 5.251-7.867ZM9.853 56.17h-.001l1.362-5.081 9.805 2.623a24.786 24.786 0 0 1 18.27 21.858v14.161c-3.968-1.061-7.935-2.124-11.905-3.191l-.616-.174C13.918 82.563 6.367 69.19 9.853 56.171Zm38.435 19.4a24.786 24.786 0 0 1 18.275-21.86l9.805-2.621 1.363 5.083c3.54 13.225-4.307 26.815-17.537 30.368h-.001c-3.16.85-6.321 1.696-9.48 2.54l-.013.004-2.412.645V75.57Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M55.525 24.577a19.681 19.681 0 0 1 2.608-12.053 19.669 19.669 0 0 1 35.119 2.45 19.668 19.668 0 0 1-32.077 21.432 19.664 19.664 0 0 1-5.65-11.829Zm30.502-10.07a2.952 2.952 0 0 0-4.175 0l-9.723 9.723-3.818-3.818a2.952 2.952 0 1 0-4.175 4.175l5.905 5.906a2.952 2.952 0 0 0 4.176 0l11.81-11.811a2.952 2.952 0 0 0 0-4.175Z" clip-rule="evenodd"/></svg>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

const DOCUMENT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: #2b2b27;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
  }
  .doc { max-width: 760px; margin: 0 auto; padding: 24px; }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 12px; border-bottom: 2px solid #2f6d3f;
  }
  .brand { display: flex; align-items: center; gap: 8px; }
  .brand-name { font-size: 18px; font-weight: 700; color: #2f6d3f; letter-spacing: -0.01em; }
  .emitted { font-size: 11px; color: #6b6b62; }
  .title-block { margin-top: 18px; }
  .kicker { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #2f6d3f; margin: 0; }
  .title { font-size: 24px; font-weight: 600; color: #20201c; margin: 4px 0 0; }
  .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .tags span { font-size: 11px; color: #4a4a42; background: #f1f0ea; border: 1px solid #e2e0d6; border-radius: 999px; padding: 2px 10px; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .summary-item { flex: 1 1 150px; border: 1px solid #e2e0d6; border-radius: 8px; padding: 8px 12px; background: #faf9f5; }
  .summary-label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7a70; }
  .summary-value { display: block; font-size: 14px; font-weight: 600; color: #20201c; margin-top: 2px; }
  .section-title { font-size: 14px; font-weight: 600; color: #20201c; margin: 24px 0 10px; }
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
  .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e0d6; font-size: 10px; color: #7a7a70; }
  @page { size: A4; margin: 14mm; }
  @media print { html, body { background: #ffffff; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
    <header class="header">
      <div class="brand">${LOGO_SVG}<span class="brand-name">Recomenda</span></div>
      <span class="emitted">Emitido em ${escapeHtml(emittedAt)}</span>
    </header>
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
    <footer class="footer">
      <span>${data.agronomistName ? `Responsável técnico: ${escapeHtml(data.agronomistName)}` : ""}</span>
      <span>Documento gerado pela plataforma Recomenda</span>
    </footer>
  </div>`;
}

function htmlShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>${body}</body>
</html>`;
}

export function buildRecommendationHtml(data: RecommendationShareData): string {
  return htmlShell(`Recomendação - ${data.title}`, buildDocBody(data));
}

/** Documento com vários talhões (um por página). */
export function buildRecommendationsHtml(
  list: RecommendationShareData[],
  title: string,
): string {
  const body = list.map((d, i) => buildDocBody(d, i > 0)).join("");
  return htmlShell(title, body);
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

function printHtml(html: string): void {
  if (typeof window === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:absolute;width:0;height:0;border:0;left:-9999px;top:0;";

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }
    frameWindow.onafterprint = cleanup;
    frameWindow.focus();
    frameWindow.print();
    // Fallback: alguns navegadores não disparam onafterprint.
    window.setTimeout(cleanup, 60000);
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);
}
