/**
 * Caderno de Safra (ou Caderno de Campo): um único PDF, pensado para ser
 * impresso e encadernado, que reúne numa ordem escolhida pelo agrônomo as
 * peças que hoje saem em documentos separados — lista de compra, estoque,
 * talhões e programação.
 *
 * O caderno NÃO recalcula nada: cada seção é o mesmo miolo dos PDFs que já
 * existem (`purchaseListSectionHtml`, `stockSectionHtml`,
 * `buildRecommendationPages`). Um número que aparece aqui e na tela diferente
 * é bug de origem, não de composição.
 *
 * Cada seção começa em folha nova — ao encadernar, ninguém quer a lista de
 * compra terminando no meio da página do estoque.
 */
import type { PurchaseListDetail } from "@recomenda/api/purchase-lists";
import {
  escapeHtml,
  footerHtml,
  headerHtml,
  htmlShell,
  LOGO_SVG,
  printHtml,
  sheetHtml,
} from "../print/print-core";
import {
  PURCHASE_LIST_CSS,
  purchaseListSectionHtml,
} from "../purchase-list/purchase-list-print-document";
import { displayRecStatus, fmtDate, recommendationStatusLabel } from "../recommendations/format";
import {
  buildRecommendationPages,
  REC_CSS,
} from "../recommendations/print-document";
import type { RecommendationShareData } from "../recommendations/share-message";
import {
  stockSectionHtml,
  type StockExportItem,
} from "../stock/stock-export";

const EM_DASH = "&mdash;";

// ---- seções ------------------------------------------------------------

export const NOTEBOOK_SECTION_IDS = [
  "cover",
  "summary",
  "purchase-list",
  "stock",
  "plots",
  "schedule",
  "notes",
] as const;

export type NotebookSectionId = (typeof NOTEBOOK_SECTION_IDS)[number];

export interface NotebookSectionMeta {
  id: NotebookSectionId;
  label: string;
  /** Uma linha, mostrada na UI de montagem e no sumário da capa. */
  description: string;
  /** Capa: sempre a primeira folha — pode ser desligada, não reordenada. */
  pinned?: boolean;
}

export const NOTEBOOK_SECTIONS: Record<NotebookSectionId, NotebookSectionMeta> = {
  cover: {
    id: "cover",
    label: "Capa",
    description: "Folha de rosto verde: logo e o nome da safra, nada mais.",
    pinned: true,
  },
  summary: {
    id: "summary",
    label: "Sumário",
    description: "Números gerais da safra e o índice das seções.",
  },
  "purchase-list": {
    id: "purchase-list",
    label: "Lista de compra",
    description: "A lista completa da safra: produtos, doses e volumes.",
  },
  stock: {
    id: "stock",
    label: "Estoque",
    description: "O que já está no galpão do produtor.",
  },
  plots: {
    id: "plots",
    label: "Talhões e hectares",
    description: "Talhão, material e área, com o total da safra.",
  },
  schedule: {
    id: "schedule",
    label: "Programação",
    description: "Resumo do cronograma de cada talhão.",
  },
  notes: {
    id: "notes",
    label: "Anotações de campo",
    description: "Páginas pautadas em branco para escrever no talhão.",
  },
};

/** Uma seção na montagem: a ordem é a do array. */
export interface NotebookSectionState {
  id: NotebookSectionId;
  enabled: boolean;
}

export const DEFAULT_NOTEBOOK_SECTIONS: NotebookSectionState[] =
  NOTEBOOK_SECTION_IDS.map((id) => ({ id, enabled: true }));

/**
 * Saneia uma montagem vinda de fora (localStorage de uma versão anterior):
 * descarta id desconhecido, completa seção nova no fim e devolve a capa à
 * primeira posição. Nunca lança — preferência corrompida vira o padrão.
 */
export function normalizeNotebookSections(input: unknown): NotebookSectionState[] {
  if (!Array.isArray(input)) return DEFAULT_NOTEBOOK_SECTIONS;

  const known = new Set<string>(NOTEBOOK_SECTION_IDS);
  const seen = new Set<NotebookSectionId>();
  const out: NotebookSectionState[] = [];

  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string" || !known.has(id) || seen.has(id as NotebookSectionId)) {
      continue;
    }
    seen.add(id as NotebookSectionId);
    out.push({
      id: id as NotebookSectionId,
      enabled: (entry as { enabled?: unknown }).enabled !== false,
    });
  }

  // Capa volta para a frente ANTES de inserir as que faltam: é a âncora que
  // decide onde o Sumário entra.
  const cover = out.findIndex((s) => s.id === "cover");
  if (cover > 0) out.unshift(out.splice(cover, 1)[0]);

  // Seção criada depois que o usuário salvou a preferência entra ligada, no
  // lugar que ela ocupa no padrão — logo depois da seção que a antecede lá.
  // Jogar no fim colocaria o Sumário atrás das folhas de anotação.
  for (let i = 0; i < NOTEBOOK_SECTION_IDS.length; i++) {
    const id = NOTEBOOK_SECTION_IDS[i];
    if (seen.has(id)) continue;
    let at = 0;
    for (let before = i - 1; before >= 0; before--) {
      const found = out.findIndex((s) => s.id === NOTEBOOK_SECTION_IDS[before]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { id, enabled: true });
    seen.add(id);
  }

  return out;
}

// ---- dados -------------------------------------------------------------

/** Linha da tabela de talhões: "Talhão 1 · M8210 · 30 ha". */
export interface NotebookPlotRow {
  plotName: string;
  /** Só aparece como coluna quando a safra tem mais de uma fazenda. */
  farmName: string | null;
  /** "Material": a(s) variedade(s) plantada(s) no talhão. */
  material: string | null;
  areaHa: number | null;
}

export interface SeasonNotebookData {
  cycleName: string;
  producerName?: string | null;
  agronomistName?: string | null;
  farmNames: string[];
  cropLabels: string[];
  plots: NotebookPlotRow[];
  purchaseList?: PurchaseListDetail | null;
  stockItems?: StockExportItem[] | null;
  /** Um bloco por talhão — o mesmo payload do PDF de recomendações. */
  schedule: RecommendationShareData[];
  /** Aviso da capa (ex.: safra histórica, estoque é retrato do galpão hoje). */
  note?: string | null;
}

export interface NotebookOptions {
  sections: NotebookSectionState[];
  /**
   * Inclui custos. Como nos outros documentos, só tem efeito se o payload
   * trouxer preço — sem PRICE_VIEW o caderno sai sem valores de qualquer forma.
   */
  showPrices?: boolean;
  /** Acrescenta uma página por talhão com doses, quantidades e registro MAPA. */
  detailedSchedule?: boolean;
  /** Quantas folhas pautadas na seção de anotações. */
  notesPages?: number;
}

export const DEFAULT_NOTES_PAGES = 2;
/** Quantas folhas pautadas o usuário pode pedir (uma resma não é caderno). */
export const MAX_NOTES_PAGES = 20;
/**
 * Mínimo 1: quem não quer folhas de anotação desliga a SEÇÃO. Ter "0 folhas"
 * junto do checkbox eram dois jeitos de dizer a mesma coisa.
 */
export const MIN_NOTES_PAGES = 1;

/** Quantidade de folhas pautadas efetiva — 0 significa nenhuma. */
export function resolveNotesPages(value: number | undefined): number {
  const n = Math.round(Number(value ?? DEFAULT_NOTES_PAGES));
  if (!Number.isFinite(n)) return DEFAULT_NOTES_PAGES;
  return Math.min(MAX_NOTES_PAGES, Math.max(MIN_NOTES_PAGES, n));
}

/**
 * Seção tem conteúdo? A UI usa para desabilitar o toggle e explicar por quê —
 * "Todo o estoque (se tiver)": sem estoque a seção não vira folha em branco.
 */
export function notebookSectionAvailable(
  id: NotebookSectionId,
  data: SeasonNotebookData,
): boolean {
  switch (id) {
    case "purchase-list":
      return (data.purchaseList?.items?.length ?? 0) > 0;
    case "stock":
      return (data.stockItems?.length ?? 0) > 0;
    case "plots":
      return data.plots.length > 0;
    case "schedule":
      return data.schedule.length > 0;
    default:
      return true;
  }
}

/** As seções que de fato viram folha: ligadas, na ordem, e com conteúdo. */
export function resolvedNotebookSections(
  data: SeasonNotebookData,
  sections: NotebookSectionState[],
): NotebookSectionId[] {
  return sections
    .filter((s) => s.enabled && notebookSectionAvailable(s.id, data))
    .map((s) => s.id);
}

// ---- formatação --------------------------------------------------------

const fmtArea = (value: number): string =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

const STATUS_CLASS: Record<string, string> = {
  PENDING: "is-pending",
  OVERDUE: "is-overdue",
  APPLIED_ON_TIME: "is-done",
  APPLIED_LATE: "is-late",
  SKIPPED: "is-skipped",
};

// ---- CSS ---------------------------------------------------------------

/**
 * Verde da marca — o mesmo `#2f6d3f` que o CORE_CSS já usa no logo, no filete do
 * cabeçalho e no número da etapa. A capa inteira é dele, então o caderno fecha
 * numa cor só.
 */
const BRAND_GREEN = "#2f6d3f";

const NOTEBOOK_CSS = `
  /* A capa sangra até a borda do papel: a margem de 14mm do @page padrão
     deixaria uma moldura branca em volta do verde. Página nomeada (suportada
     pelo Chrome, que é quem imprime aqui); onde não for, a capa só fica com a
     moldura — degrada sem quebrar. */
  @page cover { size: A4; margin: 0; }
  /* Margem de lombada: o miolo é furado/encadernado pela esquerda, então a
     margem esquerda é maior que as outras — com 14mm iguais a espiral come o
     começo das linhas. Sobrepõe o @page do CORE_CSS só neste documento. */
  @page { size: A4; margin: 14mm 14mm 14mm 22mm; }
  .nb-cover {
    page: cover;
    width: 210mm; height: 297mm;
    background: ${BRAND_GREEN}; color: #ffffff;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 30mm 26mm; overflow: hidden;
  }
  /* O logo nasce verde (fill no <svg>); no verde ele some. CSS ganha do
     atributo de apresentação e os paths herdam. */
  .nb-cover-mark { display: flex; align-items: center; gap: 12px; }
  .nb-cover-mark svg { width: 34px; height: auto; fill: #ffffff; }
  .nb-cover-mark span { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
  .nb-cover-kicker { margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em; color: rgba(255,255,255,0.72); }
  .nb-cover-title { margin: 10px 0 0; font-size: 52px; line-height: 1.08; font-weight: 600; letter-spacing: -0.02em; }
  .nb-cover-rule { width: 64px; height: 3px; margin: 22px 0 0; background: rgba(255,255,255,0.5); }
  .nb-cover-sub { margin: 22px 0 0; font-size: 17px; font-weight: 600; color: #ffffff; }
  .nb-cover-meta { margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.78); }
  .nb-cover-foot { font-size: 12px; color: rgba(255,255,255,0.72); }
  .nb-note { margin: 16px 0 0; padding: 8px 12px; border-left: 3px solid #f0d4ab; background: #fdf0e3; font-size: 11px; color: #9a5a16; }
  .nb-toc { margin-top: 26px; }
  .nb-toc ol { margin: 0; padding: 0; list-style: none; counter-reset: nb-toc; }
  .nb-toc li { counter-increment: nb-toc; display: flex; gap: 10px; align-items: baseline; padding: 7px 0; border-bottom: 1px solid #efeee8; }
  .nb-toc li::before { content: counter(nb-toc); flex: 0 0 auto; width: 20px; font-size: 11px; font-weight: 700; color: #2f6d3f; font-variant-numeric: tabular-nums; }
  .nb-toc-label { font-size: 13px; font-weight: 600; color: #20201c; }
  .nb-toc-desc { font-size: 11px; color: #7a7a70; }
  .nb-plot { margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
  .nb-plot-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 4px; border-bottom: 2px solid #2f6d3f; }
  .nb-plot-name { font-size: 13px; font-weight: 700; color: #20201c; }
  .nb-plot-meta { font-size: 11px; color: #6b6b62; }
  .nb-plot-meta .nb-sep { color: #c9c7bc; }
  .data-table .nb-idx { width: 1.8rem; text-align: right; color: #7a7a70; font-variant-numeric: tabular-nums; }
  .nb-products { font-size: 10px; color: #4a4a42; }
  .nb-note-meta { display: flex; gap: 28px; margin: 18px 0 10px; font-size: 11px; color: #6b6b62; }
  .nb-lines { margin-top: 6px; }
  .nb-lines div { height: 8mm; border-bottom: 1px solid #dedcd2; }
`;

// ---- montagem das folhas -----------------------------------------------

/** Uma folha do caderno: mesmo cabeçalho/rodapé dos outros documentos. */
function page(opts: {
  kicker: string;
  title: string;
  tags?: string[];
  body: string;
  agronomistName?: string | null;
  pageBreak: boolean;
}): string {
  const emittedAt = fmtDate(new Date().toISOString().slice(0, 10));
  // O kicker vai para o cabeçalho, que se repete: numa lista de compra de três
  // páginas, a 2ª e a 3ª continuam dizendo "Lista de compra".
  return sheetHtml({
    pageBreak: opts.pageBreak,
    header: headerHtml(emittedAt, opts.kicker),
    footer: footerHtml(opts.agronomistName),
    body: `
    <div class="title-block">
      <p class="kicker">${escapeHtml(opts.kicker)}</p>
      <h1 class="title">${escapeHtml(opts.title)}</h1>
      ${
        opts.tags?.length
          ? `<div class="tags">${opts.tags
              .map((t) => `<span>${escapeHtml(t)}</span>`)
              .join("")}</div>`
          : ""
      }
    </div>
    ${opts.body}`,
  });
}

function totalAreaHa(data: SeasonNotebookData): number {
  return data.plots.reduce((sum, plot) => sum + (plot.areaHa ?? 0), 0);
}

function totalStages(data: SeasonNotebookData): number {
  return data.schedule.reduce((sum, item) => sum + item.recommendations.length, 0);
}

/**
 * Capa: folha verde, logo e títulos. Nada de números nem índice — isso é da
 * página de Sumário. É a folha que o produtor vê na lombada do caderno.
 */
function coverPage(data: SeasonNotebookData): string {
  const meta: string[] = [];
  if (data.farmNames.length === 1) meta.push(`Fazenda ${data.farmNames[0]}`);
  else if (data.farmNames.length > 1) {
    meta.push(plural(data.farmNames.length, "fazenda", "fazendas"));
  }
  if (data.cropLabels.length) meta.push(data.cropLabels.join(" e "));

  return `
  <div class="nb-cover">
    <div class="nb-cover-mark">${LOGO_SVG}<span>Recomenda</span></div>
    <div>
      <p class="nb-cover-kicker">Caderno de safra</p>
      <h1 class="nb-cover-title">${escapeHtml(data.cycleName)}</h1>
      <div class="nb-cover-rule"></div>
      ${data.producerName ? `<p class="nb-cover-sub">${escapeHtml(data.producerName)}</p>` : ""}
      ${meta.length ? `<p class="nb-cover-meta">${escapeHtml(meta.join(" · "))}</p>` : ""}
    </div>
    <div class="nb-cover-foot">
      ${data.agronomistName ? `Responsável técnico: ${escapeHtml(data.agronomistName)}` : "Recomenda"}
    </div>
  </div>`;
}

/** Sumário: os números da safra e o índice das seções, na ordem escolhida. */
function summaryPage(
  data: SeasonNotebookData,
  order: NotebookSectionId[],
  pageBreak: boolean,
): string {
  const area = totalAreaHa(data);
  const stages = totalStages(data);

  const stats: Array<[string, string]> = [];
  if (data.farmNames.length > 1) {
    stats.push(["Fazendas", String(data.farmNames.length)]);
  }
  stats.push(["Talhões", String(data.plots.length)]);
  if (area > 0) stats.push(["Área total", `${fmtArea(area)} ha`]);
  if (stages > 0) stats.push(["Etapas", String(stages)]);

  const tags: string[] = [];
  if (data.producerName) tags.push(`Produtor: ${data.producerName}`);
  if (data.farmNames.length === 1) tags.push(`Fazenda ${data.farmNames[0]}`);
  if (data.cropLabels.length) tags.push(data.cropLabels.join(" e "));

  // Lista o miolo: a capa não é item de sumário, e o sumário não se lista.
  // Sem número de página — o Chrome não expõe contador de página ao conteúdo.
  const toc = order
    .filter((id) => id !== "cover" && id !== "summary")
    .map((id) => {
      const meta = NOTEBOOK_SECTIONS[id];
      return `<li>
          <span>
            <span class="nb-toc-label">${escapeHtml(meta.label)}</span><br />
            <span class="nb-toc-desc">${escapeHtml(meta.description)}</span>
          </span>
        </li>`;
    })
    .join("");

  const body = `
    ${
      stats.length
        ? `<dl class="cover-num">${stats
            .map(
              ([label, value]) =>
                `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
            )
            .join("")}</dl>`
        : ""
    }
    ${data.note ? `<p class="nb-note">${escapeHtml(data.note)}</p>` : ""}
    ${
      toc
        ? `<div class="nb-toc">
             <h2 class="section-title">Neste caderno</h2>
             <ol>${toc}</ol>
           </div>`
        : ""
    }`;

  return page({
    kicker: "Sumário",
    title: data.cycleName,
    tags,
    body,
    agronomistName: data.agronomistName,
    pageBreak,
  });
}

function purchaseListPage(
  data: SeasonNotebookData,
  options: NotebookOptions,
  pageBreak: boolean,
): string {
  const list = data.purchaseList!;
  const tags: string[] = [];
  if (data.producerName) tags.push(`Produtor: ${data.producerName}`);
  if (list.variety) tags.push(`Variedade: ${list.variety}`);

  return page({
    kicker: "Lista de compra",
    title: list.name,
    tags,
    body: purchaseListSectionHtml(list, { showPrices: options.showPrices }),
    agronomistName: data.agronomistName,
    pageBreak,
  });
}

function stockPage(
  data: SeasonNotebookData,
  options: NotebookOptions,
  pageBreak: boolean,
): string {
  const items = data.stockItems ?? [];
  return page({
    kicker: "Estoque",
    title: data.producerName ? `Estoque · ${data.producerName}` : "Estoque do produtor",
    tags: data.producerName ? [`Produtor: ${data.producerName}`] : [],
    body: stockSectionHtml(
      {
        producerName: data.producerName,
        agronomistName: data.agronomistName,
        items,
      },
      { showPrices: options.showPrices },
    ),
    agronomistName: data.agronomistName,
    pageBreak,
  });
}

function plotsPage(data: SeasonNotebookData, pageBreak: boolean): string {
  const multiFarm = data.farmNames.length > 1;
  const area = totalAreaHa(data);

  const rows = data.plots
    .map(
      (plot) => `
        <tr>
          ${multiFarm ? `<td>${plot.farmName ? escapeHtml(plot.farmName) : EM_DASH}</td>` : ""}
          <td>${escapeHtml(plot.plotName)}</td>
          <td>${plot.material ? escapeHtml(plot.material) : EM_DASH}</td>
          <td class="num">${plot.areaHa != null && plot.areaHa > 0 ? `${fmtArea(plot.areaHa)} ha` : EM_DASH}</td>
        </tr>`,
    )
    .join("");

  const body = `
    <section>
      <h2 class="section-title">Talhões da safra</h2>
      <table class="data-table">
        <thead>
          <tr>
            ${multiFarm ? `<th>Fazenda</th>` : ""}
            <th>Talhão</th>
            <th>Material</th>
            <th class="num">Área</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            ${multiFarm ? `<td></td>` : ""}
            <td>${plural(data.plots.length, "talhão", "talhões")}</td>
            <td></td>
            <td class="num">${area > 0 ? `${fmtArea(area)} ha` : EM_DASH}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;

  return page({
    kicker: "Talhões e hectares",
    title: data.cycleName,
    tags: data.producerName ? [`Produtor: ${data.producerName}`] : [],
    body,
    agronomistName: data.agronomistName,
    pageBreak,
  });
}

/** Resumo do cronograma: uma tabela compacta por talhão, sem doses. */
function schedulePages(
  data: SeasonNotebookData,
  options: NotebookOptions,
  pageBreak: boolean,
): string {
  const blocks = data.schedule
    .map((item) => {
      const meta: string[] = [];
      if (item.title) meta.push(escapeHtml(item.title));
      const areaHa = item.spec?.areaHa;
      if (areaHa != null && areaHa > 0) meta.push(`${fmtArea(areaHa)} ha`);
      if (item.spec?.farmName) meta.push(escapeHtml(item.spec.farmName));

      const rows = item.recommendations
        .map((rec, index) => {
          const statusClass = STATUS_CLASS[displayRecStatus(rec)] ?? "is-pending";
          const products = rec.items.map((p) => p.product_name).join(", ");
          return `
            <tr>
              <td class="nb-idx">${index + 1}</td>
              <td>${escapeHtml(rec.name)}</td>
              <td class="num">${rec.predicted_date_current ? escapeHtml(fmtDate(rec.predicted_date_current)) : EM_DASH}</td>
              <td><span class="status ${statusClass}">${escapeHtml(recommendationStatusLabel(rec))}</span></td>
              <td class="nb-products">${products ? escapeHtml(products) : EM_DASH}</td>
            </tr>`;
        })
        .join("");

      return `
        <div class="nb-plot">
          <div class="nb-plot-head">
            <span class="nb-plot-name">${escapeHtml(item.plotName ?? item.title)}</span>
            <span class="nb-plot-meta">${meta.join(' <span class="nb-sep">·</span> ')}</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th class="nb-idx">#</th>
                <th>Etapa</th>
                <th class="num">Previsto</th>
                <th>Situação</th>
                <th>Produtos</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    })
    .join("");

  const summary = page({
    kicker: "Programação da safra",
    title: data.cycleName,
    tags: data.producerName ? [`Produtor: ${data.producerName}`] : [],
    body: `<section>
      <h2 class="section-title">Cronograma por talhão</h2>
      ${blocks}
    </section>`,
    agronomistName: data.agronomistName,
    pageBreak,
  });

  if (!options.detailedSchedule) return summary;

  // Detalhamento: as mesmas páginas do PDF de recomendações, uma por talhão.
  // Sempre depois do resumo, então cada uma pode abrir folha nova sem risco de
  // virar uma página em branco no começo do caderno.
  return (
    summary +
    buildRecommendationPages(data.schedule, { showPrices: options.showPrices })
  );
}

/**
 * 22 linhas de 8mm: o que sobra de uma A4 com margem de 14mm depois do
 * cabeçalho, do título, da faixa "Talhão/Data" e do rodapé. Com 26 o rodapé
 * transbordava e cada folha pautada virava duas páginas no PDF.
 */
const NOTE_LINES = 22;

function notesPages(data: SeasonNotebookData, count: number): string {
  const lines = Array.from({ length: NOTE_LINES }, () => "<div></div>").join("");
  return Array.from({ length: count }, () =>
    page({
      kicker: "Anotações de campo",
      title: data.cycleName,
      body: `
        <div class="nb-note-meta">
          <span>Talhão: ______________________</span>
          <span>Data: ______/______/__________</span>
        </div>
        <div class="nb-lines">${lines}</div>`,
      agronomistName: data.agronomistName,
      pageBreak: true,
    }),
  ).join("");
}

// ---- API ---------------------------------------------------------------

export function buildSeasonNotebookHtml(
  data: SeasonNotebookData,
  options: NotebookOptions,
): string {
  const order = resolvedNotebookSections(data, options.sections);

  const pages = order.map((id, index) => {
    // A primeira seção ligada abre o documento; o resto começa em folha nova.
    const pageBreak = index > 0;
    switch (id) {
      case "cover":
        return coverPage(data);
      case "summary":
        return summaryPage(data, order, pageBreak);
      case "purchase-list":
        return purchaseListPage(data, options, pageBreak);
      case "stock":
        return stockPage(data, options, pageBreak);
      case "plots":
        return plotsPage(data, pageBreak);
      case "schedule":
        return schedulePages(data, options, pageBreak);
      case "notes":
        return notesPages(data, resolveNotesPages(options.notesPages));
    }
  });

  return htmlShell(
    `Caderno de safra - ${data.cycleName}`,
    pages.join(""),
    REC_CSS + PURCHASE_LIST_CSS + NOTEBOOK_CSS,
  );
}

/** Abre o caderno no diálogo de impressão ("Salvar como PDF"). */
export function printSeasonNotebook(
  data: SeasonNotebookData,
  options: NotebookOptions,
): void {
  if (resolvedNotebookSections(data, options.sections).length === 0) return;
  printHtml(buildSeasonNotebookHtml(data, options));
}
