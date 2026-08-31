import type { Recommendation, RecommendationItem } from "@recomenda/api";
import { displayRecStatus, fmtDate, recommendationStatusLabel } from "./format";
import {
  formulationShortLabel,
  resolveFormulationKey,
} from "./formulation-mix-order";
import { sortRecommendationItemsByMixOrder } from "./mix-order";
import type { RecommendationShareData, SharePlotSpec } from "./share-message";
import {
  escapeHtml,
  fmtBrl,
  footerHtml,
  headerHtml,
  htmlShell,
  printHtml,
} from "../print/print-core";

/** Capa dos escopos acima do talhão (fazenda, safra). */
export interface DocumentCover {
  /** Sobretítulo, ex.: "Programação da fazenda". */
  kicker: string;
  /** Nome da fazenda ou da safra. */
  title: string;
  tags?: string[];
  stats?: Array<{ label: string; value: string }>;
}

export interface PrintOptions {
  /**
   * Inclui custo por hectare e totais. Só tem efeito se os preços tiverem sido
   * passados em `unitPriceByProduct`; quem não tem PRICE_VIEW recebe o payload
   * sem preço e o documento sai sem valores de qualquer forma.
   */
  showPrices?: boolean;
  /** Página de capa + consolidado (escopos fazenda/safra). */
  cover?: DocumentCover | null;
}

const EM_DASH = "&mdash;";

function itemFormulationShort(item: RecommendationItem): string {
  const key =
    item.formulation_key ?? resolveFormulationKey(item.equivalence_group);
  return formulationShortLabel(key);
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: "is-pending",
  OVERDUE: "is-overdue",
  APPLIED_ON_TIME: "is-done",
  APPLIED_LATE: "is-late",
  SKIPPED: "is-skipped",
};

function fmtNum(value: number, digits = 1): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

/** Medidas (área, espaçamento): casas fixas, para "0,50 m" não virar "0,5 m". */
function fmtMeasure(value: number, digits = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtQty(value: number, unit: string): string {
  if (value <= 0) return EM_DASH;
  return `${fmtNum(value)} ${escapeHtml(unit)}`;
}

/** Área de referência do talhão. Espelha o servidor, que calcula
 *  `total_quantity = dose × área CADASTRAL` — usar a plantada aqui faria o
 *  custo divergir da quantidade impressa ao lado. */
function plotAreaHa(data: RecommendationShareData): number {
  const area = data.spec?.areaHa;
  return typeof area === "number" && area > 0 ? area : 0;
}

/**
 * Custo por hectare do item: preço unitário da lista × dose DESTA recomendação.
 * Nunca reaproveita o custo calculado na lista de compra — a dose do modelo
 * pode divergir da dose cadastrada lá.
 */
function itemCostPerHa(
  item: RecommendationItem,
  prices: Record<string, number> | undefined,
): number | null {
  const price = prices?.[item.local_product_id];
  if (!price || !Number.isFinite(price)) return null;
  if (!(item.dose_per_hectare > 0)) return null;
  return price * item.dose_per_hectare;
}

function stageCostPerHa(
  rec: Recommendation,
  prices: Record<string, number> | undefined,
): number | null {
  let sum = 0;
  let any = false;
  for (const item of rec.items) {
    const cost = itemCostPerHa(item, prices);
    if (cost != null) {
      sum += cost;
      any = true;
    }
  }
  return any ? sum : null;
}

function docCostPerHa(
  data: RecommendationShareData,
  prices: Record<string, number> | undefined,
): number | null {
  let sum = 0;
  let any = false;
  for (const rec of data.recommendations) {
    const cost = stageCostPerHa(rec, prices);
    if (cost != null) {
      sum += cost;
      any = true;
    }
  }
  return any ? sum : null;
}

/**
 * Empresa para exibir. O AGROFIT grava o titular com a cidade junto
 * ("Syngenta Proteção de Cultivos Ltda. – São Paulo/SP", até 92 caracteres) —
 * numa coluna de A4 isso quebra em três linhas. O banco mantém o valor
 * completo, que é o registro oficial; aqui só o nome da empresa aparece.
 */
function shortManufacturer(value: string): string {
  return value
    .replace(/\s*[–-]\s*[^–-]{2,60}\/[A-Z]{2}\.?\s*$/u, "")
    .replace(/\s{2,}[^–-]{2,60}\/[A-Z]{2}\.?\s*$/u, "")
    .trim();
}

/** Colunas Empresa/Registro só entram se algum produto do documento tiver. */
function hasRegistryData(list: RecommendationShareData[]): boolean {
  return list.some((data) =>
    data.recommendations.some((rec) =>
      rec.items.some((item) => item.manufacturer || item.mapa_registration),
    ),
  );
}

/** O documento só ganha coluna de custo se houver preço para mostrar. */
function hasAnyPrice(list: RecommendationShareData[], showPrices?: boolean): boolean {
  if (!showPrices) return false;
  return list.some((data) => docCostPerHa(data, data.unitPriceByProduct) != null);
}

function productRowsHtml(rec: Recommendation, opts: RenderOpts): string {
  if (rec.items.length === 0) {
    return `<p class="empty">Nenhum produto vinculado a esta etapa.</p>`;
  }
  const rows = sortRecommendationItemsByMixOrder(rec.items)
    .map((item) => {
      const cost = itemCostPerHa(item, opts.prices);
      return `
        <tr>
          <td class="form">${escapeHtml(itemFormulationShort(item))}</td>
          <td>${escapeHtml(item.product_name)}${
            item.is_substitution ? `<span class="sub"> (substituído)</span>` : ""
          }</td>
          ${
            opts.registry
              ? `<td class="firm">${item.manufacturer ? escapeHtml(shortManufacturer(item.manufacturer)) : EM_DASH}</td>
                 <td class="num">${item.mapa_registration ? escapeHtml(item.mapa_registration) : EM_DASH}</td>`
              : ""
          }
          <td class="num">${item.dose_per_hectare} ${escapeHtml(item.dose_unit)}</td>
          <td class="num">${fmtQty(item.total_quantity, item.dose_unit)}</td>
          ${opts.money ? `<td class="num">${cost == null ? EM_DASH : fmtBrl(cost)}</td>` : ""}
        </tr>`;
    })
    .join("");

  const total = stageCostPerHa(rec, opts.prices);
  const foot =
    opts.money && total != null
      ? `<tfoot><tr>
           <td class="form"></td><td>Total da etapa</td>
           ${opts.registry ? `<td></td><td class="num"></td>` : ""}
           <td class="num"></td><td class="num"></td>
           <td class="num">${fmtBrl(total)}</td>
         </tr></tfoot>`
      : "";

  return `
    <table class="products">
      <thead>
        <tr><th class="form">Form.</th><th>Produto</th>${
          opts.registry
            ? `<th class="firm">Empresa</th><th class="num">Registro</th>`
            : ""
        }<th class="num">Dose/ha</th><th class="num">Quantidade total</th>${
          opts.money ? `<th class="num">Custo/ha</th>` : ""
        }</tr>
      </thead>
      <tbody>${rows}</tbody>
      ${foot}
    </table>`;
}

function stageHtml(rec: Recommendation, index: number, opts: RenderOpts): string {
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
      ${productRowsHtml(rec, opts)}
      ${rec.notes ? `<p class="notes">Observações: ${escapeHtml(rec.notes)}</p>` : ""}
    </div>`;
}

/**
 * Ficha técnica do talhão. Campo sem valor sai como "—" de propósito: mostra
 * ao produtor que ali deveria haver informação e cobra o preenchimento.
 */
function specHtml(spec: SharePlotSpec | null | undefined): string {
  if (!spec) return "";

  const varieties = spec.varieties ?? [];
  const varietyLabel = varieties.length
    ? varieties.map((v) => escapeHtml(v.variety)).join(", ")
    : EM_DASH;
  // População: uma variedade → valor direto; várias → "variedade: valor".
  const population = varieties.filter((v) => v.thousandPlantsPerHa != null);
  const populationLabel = !population.length
    ? EM_DASH
    : population.length === 1
      ? `${fmtNum(Number(population[0].thousandPlantsPerHa), 0)} mil pl/ha`
      : population
          .map(
            (v) =>
              `${escapeHtml(v.variety)}: ${fmtNum(Number(v.thousandPlantsPerHa), 0)}`,
          )
          .join(" · ");

  const cells: Array<[string, string]> = [
    ["Área cadastral", spec.areaHa != null ? `${fmtMeasure(spec.areaHa)} ha` : EM_DASH],
    [
      "Área plantada",
      spec.plantedAreaHa != null ? `${fmtMeasure(spec.plantedAreaHa)} ha` : EM_DASH,
    ],
    ["Cultura", spec.cropLabel ? escapeHtml(spec.cropLabel) : EM_DASH],
    ["Variedade", varietyLabel],
    ["População", populationLabel],
    ["Espaçamento", spec.spacingM != null ? `${fmtMeasure(spec.spacingM)} m` : EM_DASH],
    ["Ciclo", spec.cycleDays != null ? `${spec.cycleDays} dias` : EM_DASH],
    [
      "Dessecação",
      spec.desiccationDate ? escapeHtml(fmtDate(spec.desiccationDate)) : EM_DASH,
    ],
    ["Localização", spec.farmLocation ? escapeHtml(spec.farmLocation) : EM_DASH],
  ];

  return `
    <h2 class="section-title">Ficha do talhão</h2>
    <dl class="spec">
      ${cells
        .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
        .join("")}
    </dl>`;
}

/** Resumo por etapa com custo — só faz sentido quando há preço. */
function plotSummaryHtml(data: RecommendationShareData, opts: RenderOpts): string {
  if (!opts.money) return "";
  const total = docCostPerHa(data, opts.prices);
  if (total == null) return "";
  const area = plotAreaHa(data);

  const rows = data.recommendations
    .map((rec, index) => {
      const cost = stageCostPerHa(rec, opts.prices);
      return `
        <tr>
          <td>${index + 1} · ${escapeHtml(rec.name)}</td>
          <td class="num">${rec.predicted_date_current ? escapeHtml(fmtDate(rec.predicted_date_current)) : EM_DASH}</td>
          <td class="num">${cost == null ? EM_DASH : fmtBrl(cost)}</td>
          <td class="num">${cost == null || area <= 0 ? EM_DASH : fmtBrl(cost * area)}</td>
        </tr>`;
    })
    .join("");

  const label = `${data.recommendations.length} ${data.recommendations.length === 1 ? "etapa" : "etapas"}${
    area > 0 ? ` · ${fmtMeasure(area)} ha` : ""
  }`;

  return `
    <h2 class="section-title">Resumo do talhão</h2>
    <table class="data-table">
      <thead>
        <tr><th>Etapa</th><th class="num">Data</th><th class="num">Custo/ha</th><th class="num">Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td>${label}</td><td class="num"></td>
          <td class="num">${fmtBrl(total)}</td>
          <td class="num">${area > 0 ? fmtBrl(total * area) : EM_DASH}</td>
        </tr>
      </tfoot>
    </table>`;
}

interface RenderOpts {
  /** Renderiza colunas de dinheiro. */
  money: boolean;
  /** Renderiza Empresa e Registro (MAPA). */
  registry: boolean;
  prices?: Record<string, number>;
}

/** CSS específico da recomendação (etapas/produtos/status/ficha). O genérico
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
  .products tfoot td { font-weight: 700; border-top: 1px solid #e2e0d6; border-bottom: none; }
  .products .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .products .firm { font-size: 10px; color: #4a4a42; max-width: 10rem; }
  .products .form { width: 3.2rem; text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 0.03em; color: #6b6b62; white-space: nowrap; }
  .sub { font-size: 10px; color: #9a5a16; }
  .notes { margin: 10px 0 0 32px; font-size: 11px; color: #4a4a42; font-style: italic; }
  .empty { font-size: 11px; color: #7a7a70; margin: 0 0 0 32px; }
  .spec { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 1px; margin: 0; background: #e2e0d6; border: 1px solid #e2e0d6; border-radius: 8px; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  .spec div { background: #ffffff; padding: 7px 10px; }
  .spec dt { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #7a7a70; margin: 0; }
  .spec dd { font-size: 12px; font-weight: 600; color: #20201c; margin: 1px 0 0; }
  .cover-num { display: flex; flex-wrap: wrap; gap: 26px; margin: 20px 0 0; padding: 16px 0; border-top: 1px solid #e2e0d6; border-bottom: 1px solid #e2e0d6; }
  .cover-num div { min-width: 92px; }
  .cover-num dt { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7a70; margin: 0; }
  .cover-num dd { font-size: 20px; font-weight: 600; color: #20201c; margin: 2px 0 0; font-variant-numeric: tabular-nums; }
`;

/** Corpo (`.doc`) de um talhão — reutilizado no documento simples e no multi. */
function buildDocBody(
  data: RecommendationShareData,
  pageBreak = false,
  opts: RenderOpts = { money: false, registry: false },
): string {
  const progressPct =
    data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
  const emittedAt = fmtDate(new Date().toISOString().slice(0, 10));

  const tags: string[] = [];
  if (data.spec?.farmName)
    tags.push(`<span>Fazenda ${escapeHtml(data.spec.farmName)}</span>`);
  if (data.plotName) tags.push(`<span>Talhão ${escapeHtml(data.plotName)}</span>`);
  if (data.spec?.cycleName)
    tags.push(`<span>${escapeHtml(data.spec.cycleName)}</span>`);
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

  const stageOpts: RenderOpts = { ...opts, prices: data.unitPriceByProduct };
  const stages =
    data.recommendations.length > 0
      ? data.recommendations
          .map((rec, index) => stageHtml(rec, index, stageOpts))
          .join("")
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
    ${specHtml(data.spec)}
    <section>
      <h2 class="section-title">Cronograma de aplicações</h2>
      ${stages}
    </section>
    ${plotSummaryHtml(data, stageOpts)}
    ${footerHtml(data.agronomistName)}
  </div>`;
}

/** Linha do consolidado: um produto somado em todos os talhões do escopo. */
interface ConsolidatedRow {
  name: string;
  unit: string;
  quantity: number;
  stages: Set<string>;
  cost: number | null;
}

function consolidate(list: RecommendationShareData[]): ConsolidatedRow[] {
  const byProduct = new Map<string, ConsolidatedRow>();
  for (const data of list) {
    const prices = data.unitPriceByProduct;
    for (const rec of data.recommendations) {
      for (const item of rec.items) {
        const key = item.local_product_id || item.product_name;
        const row =
          byProduct.get(key) ??
          ({
            name: item.product_name,
            unit: item.dose_unit,
            quantity: 0,
            stages: new Set<string>(),
            cost: null,
          } satisfies ConsolidatedRow);
        row.quantity += item.total_quantity;
        row.stages.add(rec.name);
        const price = prices?.[item.local_product_id];
        if (price && Number.isFinite(price)) {
          // Custo = preço × quantidade total (que já é dose × área) — mesma
          // conta da quantidade impressa, então os números fecham.
          row.cost = (row.cost ?? 0) + price * item.total_quantity;
        }
        byProduct.set(key, row);
      }
    }
  }
  return [...byProduct.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Página de capa dos escopos fazenda/safra: números, talhões e consolidado. */
function buildCoverBody(
  cover: DocumentCover,
  list: RecommendationShareData[],
  opts: RenderOpts,
): string {
  const emittedAt = fmtDate(new Date().toISOString().slice(0, 10));

  const stats = (cover.stats ?? [])
    .map(
      (stat) =>
        `<div><dt>${escapeHtml(stat.label)}</dt><dd>${escapeHtml(stat.value)}</dd></div>`,
    )
    .join("");

  const plotRows = list
    .map((data) => {
      const area = plotAreaHa(data);
      const varieties = data.spec?.varieties ?? [];
      const variety = varieties.length
        ? escapeHtml(varieties.map((v) => v.variety).join(", "))
        : EM_DASH;
      const cost = docCostPerHa(data, data.unitPriceByProduct);
      return `
        <tr>
          <td>${data.plotName ? escapeHtml(data.plotName) : EM_DASH}</td>
          <td>${variety}</td>
          <td class="num">${area > 0 ? `${fmtMeasure(area)} ha` : EM_DASH}</td>
          <td class="num">${data.plantingDate ? escapeHtml(fmtDate(data.plantingDate)) : EM_DASH}</td>
          <td class="num">${data.done}/${data.total}</td>
          ${
            opts.money
              ? `<td class="num">${cost == null || area <= 0 ? EM_DASH : fmtBrl(cost * area)}</td>`
              : ""
          }
        </tr>`;
    })
    .join("");

  const totalArea = list.reduce((sum, data) => sum + plotAreaHa(data), 0);
  const grandTotal = list.reduce((sum, data) => {
    const cost = docCostPerHa(data, data.unitPriceByProduct);
    const area = plotAreaHa(data);
    return cost != null && area > 0 ? sum + cost * area : sum;
  }, 0);

  const rows = consolidate(list);
  const productRows = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td class="num">${row.stages.size}</td>
          <td class="num">${fmtQty(row.quantity, row.unit)}</td>
          ${opts.money ? `<td class="num">${row.cost == null ? EM_DASH : fmtBrl(row.cost)}</td>` : ""}
        </tr>`,
    )
    .join("");
  const productsTotal = rows.reduce((sum, row) => sum + (row.cost ?? 0), 0);

  return `
  <div class="doc">
    ${headerHtml(emittedAt)}
    <div class="title-block">
      <p class="kicker">${escapeHtml(cover.kicker)}</p>
      <h1 class="title">${escapeHtml(cover.title)}</h1>
      ${
        cover.tags?.length
          ? `<div class="tags">${cover.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
          : ""
      }
    </div>
    ${stats ? `<dl class="cover-num">${stats}</dl>` : ""}

    <h2 class="section-title">Talhões</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Talhão</th><th>Variedade</th><th class="num">Área</th>
          <th class="num">Plantio</th><th class="num">Etapas</th>
          ${opts.money ? `<th class="num">Custo</th>` : ""}
        </tr>
      </thead>
      <tbody>${plotRows}</tbody>
      <tfoot>
        <tr>
          <td>${list.length} ${list.length === 1 ? "talhão" : "talhões"}</td>
          <td></td>
          <td class="num">${totalArea > 0 ? `${fmtMeasure(totalArea)} ha` : EM_DASH}</td>
          <td class="num"></td><td class="num"></td>
          ${opts.money ? `<td class="num">${grandTotal > 0 ? fmtBrl(grandTotal) : EM_DASH}</td>` : ""}
        </tr>
      </tfoot>
    </table>

    <h2 class="section-title">Consolidado de produtos</h2>
    ${
      rows.length
        ? `<table class="data-table">
             <thead>
               <tr><th>Produto</th><th class="num">Etapas</th><th class="num">Quantidade total</th>${
                 opts.money ? `<th class="num">Custo</th>` : ""
               }</tr>
             </thead>
             <tbody>${productRows}</tbody>
             ${
               opts.money && productsTotal > 0
                 ? `<tfoot><tr><td>${rows.length} produtos</td><td class="num"></td><td class="num"></td><td class="num">${fmtBrl(productsTotal)}</td></tr></tfoot>`
                 : ""
             }
           </table>`
        : `<p class="empty" style="margin-left:0">Nenhum produto programado.</p>`
    }

    ${footerHtml(list[0]?.agronomistName)}
  </div>`;
}

export function buildRecommendationHtml(
  data: RecommendationShareData,
  options: PrintOptions = {},
): string {
  const opts: RenderOpts = {
    money: hasAnyPrice([data], options.showPrices),
    registry: hasRegistryData([data]),
  };
  return htmlShell(
    `Recomendação - ${data.title}`,
    buildDocBody(data, false, opts),
    REC_CSS,
  );
}

/** Documento com vários talhões (um por página), com capa opcional. */
export function buildRecommendationsHtml(
  list: RecommendationShareData[],
  title: string,
  options: PrintOptions = {},
): string {
  const opts: RenderOpts = {
    money: hasAnyPrice(list, options.showPrices),
    registry: hasRegistryData(list),
  };
  const cover = options.cover
    ? buildCoverBody(options.cover, list, opts)
    : "";
  // Com capa, o primeiro talhão também começa em página nova.
  const bodies = list
    .map((data, index) => buildDocBody(data, Boolean(cover) || index > 0, opts))
    .join("");
  return htmlShell(title, cover + bodies, REC_CSS);
}

/**
 * Imprime a recomendação num iframe isolado (com CSS próprio), sem capturar a
 * UI do app. O navegador usa o <title> como nome padrão ao "Salvar como PDF".
 */
export function printRecommendation(
  data: RecommendationShareData,
  options: PrintOptions = {},
): void {
  printHtml(buildRecommendationHtml(data, options));
}

/** Imprime vários talhões num único PDF (um por página). */
export function printRecommendations(
  list: RecommendationShareData[],
  title = "Recomendações",
  options: PrintOptions = {},
): void {
  if (list.length === 0) return;
  printHtml(buildRecommendationsHtml(list, title, options));
}
