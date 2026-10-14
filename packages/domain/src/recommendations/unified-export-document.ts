import type { Recommendation, RecommendationItem } from "@recomenda/api";
import { DOSE_UNIT_SHORT_LABELS, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import {
  escapeHtml,
  fmtBrl,
  headerHtml,
  htmlShell,
  sheetHtml,
} from "../print/print-core";
import { displayRecStatus, recommendationStatusLabel } from "./format";
import {
  formulationShortLabel,
  resolveFormulationKey,
} from "./formulation-mix-order";
import { sortRecommendationItemsByMixOrder } from "./mix-order";
import { suggestPhenologicalStage } from "./phenology";
import {
  fmtHectares,
  fmtQuantity,
  fmtTankCount,
  productQuantities,
} from "./prescription-calc";
import {
  applicationWindowDates,
  nonSprayOperation,
  recipeTargetFor,
  stagePrescription,
} from "./recipe-document";
import type { RecommendationShareData } from "./share-message";

/**
 * PDF único do Exportar: visão geral (planejamento e compra) e, em seguida,
 * uma receita por aplicação para o operador. Etapa pulada não entra.
 * Preço, quando ligado, fica só no consolidado da visão geral.
 */

const TRIGGER_LABELS: Record<string, string> = {
  PRE_PLANTING: "Pré-plantio",
  PLANTING: "Plantio",
  POST_PLANTING: "Pós-plantio",
};

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

function triggerLabel(type: string | undefined): string | null {
  if (!type) return null;
  return TRIGGER_LABELS[type] ?? null;
}
const TODO = `<span class="todo">A definir</span>`;
const EM = "—";

interface RecipeEntry {
  n: number;
  data: RecommendationShareData;
  rec: Recommendation;
}

function ymdToBr(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function areaHaOf(data: RecommendationShareData): number | null {
  const area = data.spec?.plantedAreaHa ?? data.spec?.areaHa;
  return typeof area === "number" && area > 0 ? area : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

function doseUnit(unit: string): string {
  return (DOSE_UNIT_SHORT_LABELS as Record<string, string>)[unit] ?? unit;
}

function totalUnit(unit: string): string {
  return doseUnit(unit).replace(/\/ha$/, "");
}

function fmtDose(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function fmtHa(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

function varietiesOf(data: RecommendationShareData): string {
  return (data.spec?.varieties ?? []).map((v) => v.variety).filter(Boolean).join(", ");
}

function activeRecs(data: RecommendationShareData): Recommendation[] {
  return data.recommendations.filter((rec) => rec.status !== "SKIPPED");
}

function recipeEntries(list: RecommendationShareData[]): RecipeEntry[] {
  const rows = list.flatMap((data) =>
    activeRecs(data).map((rec) => ({ data, rec })),
  );
  rows.sort((a, b) => {
    const da = a.rec.predicted_date_current ?? "9999-99-99";
    const db = b.rec.predicted_date_current ?? "9999-99-99";
    if (da !== db) return da < db ? -1 : 1;
    const plot = (a.data.plotName ?? "").localeCompare(b.data.plotName ?? "", "pt-BR");
    if (plot !== 0) return plot;
    return a.rec.order_index - b.rec.order_index;
  });
  return rows.map((row, index) => ({ ...row, n: index + 1 }));
}

function windowShort(rec: Recommendation, plantingDate: string | null | undefined): string {
  const { fromYmd, toYmd } = applicationWindowDates(rec, plantingDate);
  const a = ymdToBr(fromYmd);
  const b = ymdToBr(toYmd);
  if (!a || !b) return EM;
  if (a === b) return a.slice(0, 5);
  if (a.slice(3, 5) === b.slice(3, 5)) return `${a.slice(0, 2)}–${b.slice(0, 5)}`;
  return `${a.slice(0, 5)}–${b.slice(0, 5)}`;
}

function windowFull(rec: Recommendation, plantingDate: string | null | undefined): string {
  const { fromYmd, toYmd } = applicationWindowDates(rec, plantingDate);
  const a = ymdToBr(fromYmd);
  const b = ymdToBr(toYmd);
  if (!a || !b) return "Janela a definir";
  if (a === b) return `Janela ${a.slice(0, 5)}`;
  return `Janela ${a.slice(0, 5)} a ${b.slice(0, 5)}`;
}

function itemMeta(item: RecommendationItem): string {
  const formKey = item.formulation_key ?? resolveFormulationKey(item.equivalence_group);
  const form = formKey && formKey !== "OTHER" ? formulationShortLabel(formKey) : "";
  const category = item.category
    ? ((PRODUCT_CATEGORY_LABELS as Record<string, string>)[item.category] ?? "")
    : "";
  return [form === "—" ? "" : form, category].filter(Boolean).join(" · ");
}

function statusBadge(rec: Recommendation): string {
  const status = displayRecStatus(rec);
  return `<span class="badge is-${status.toLowerCase().replace(/_/g, "-")}">${escapeHtml(
    recommendationStatusLabel(rec).toUpperCase(),
  )}</span>`;
}

function appliedOf(recs: Recommendation[]): string {
  const done = recs.filter((rec) => APPLIED.has(displayRecStatus(rec)) || APPLIED.has(rec.status)).length;
  return `${done} de ${recs.length}`;
}

function overviewBody(list: RecommendationShareData[], entries: RecipeEntry[], showPrices: boolean): string {
  const crops = unique(list.map((data) => data.spec?.cropLabel));
  const cycles = unique(list.map((data) => data.spec?.cycleName));
  const producers = unique(list.map((data) => data.producerName));
  const farms = unique(list.map((data) => data.spec?.farmName));
  const locations = unique(list.map((data) => data.spec?.farmLocation));
  const heading = [crops.join(", ") || "Recomendação", cycles.join(", ")].filter(Boolean).join(" · ");
  const safraCell = cycles.length === 1 ? cycles[0].replace(/^safra\s+/i, "") : cycles.join(", ") || EM;
  const farmCell =
    farms.length === 0
      ? EM
      : farms.length === 1
        ? `${farms[0]}${locations.length === 1 ? ` · ${locations[0]}` : ""}`
        : farms.join(", ");
  const areas = list.map(areaHaOf);
  const totalArea = areas.reduce<number>((sum, area) => sum + (area ?? 0), 0);
  const allActive = list.flatMap(activeRecs);

  const schedule = entries
    .map((entry) => {
      const presc = stagePrescription(entry.rec, areaHaOf(entry.data));
      const mix =
        nonSprayOperation(entry.rec.items) == null && presc.totalMixL != null
          ? `${fmtQuantity(presc.totalMixL)} L`
          : EM;
      return `<tr>
        <td>${entry.n}</td>
        <td class="strong">${escapeHtml(entry.rec.name)}</td>
        <td>${escapeHtml(entry.data.plotName ?? EM)}</td>
        <td>${escapeHtml(triggerLabel(entry.rec.trigger_type) ?? EM)}</td>
        <td>${escapeHtml(ymdToBr(entry.rec.predicted_date_current) ?? EM)}</td>
        <td>${escapeHtml(windowShort(entry.rec, entry.data.plantingDate))}</td>
        <td class="num">${mix}</td>
        <td>${statusBadge(entry.rec)}</td>
        <td>receita ${entry.n}</td>
      </tr>`;
    })
    .join("");

  const plots = list
    .map((data) => {
      const area = areaHaOf(data);
      const spacing = data.spec?.spacingM;
      return `<tr>
        <td class="strong">${escapeHtml(data.plotName ?? EM)}</td>
        <td>${escapeHtml(varietiesOf(data) || EM)}</td>
        <td>${escapeHtml(ymdToBr(data.plantingDate) ?? EM)}</td>
        <td>${spacing != null ? `${spacing.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` : EM}</td>
        <td class="num">${area != null ? fmtHa(area) : EM}</td>
        <td class="num">${appliedOf(activeRecs(data))}</td>
      </tr>`;
    })
    .join("");

  const products = new Map<
    string,
    { name: string; meta: string; unit: string; qty: number; apps: number; cost: number | null }
  >();
  for (const entry of entries) {
    const presc = stagePrescription(entry.rec, areaHaOf(entry.data));
    for (const item of entry.rec.items) {
      const key = `${item.local_product_id}|${item.dose_unit}`;
      const row = products.get(key) ?? {
        name: item.product_name,
        meta: itemMeta(item),
        unit: totalUnit(item.dose_unit),
        qty: 0,
        apps: 0,
        cost: null,
      };
      const qty = productQuantities(item.dose_per_hectare, presc, "HA", item.area_factor).total;
      if (qty != null) row.qty += qty;
      row.apps += 1;
      const price = entry.data.unitPriceByProduct?.[item.local_product_id];
      if (showPrices && price && qty != null) row.cost = (row.cost ?? 0) + price * qty;
      products.set(key, row);
    }
  }
  const productRows = [...products.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(
      (row) => `<tr>
        <td class="strong">${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.meta || EM)}</td>
        <td class="num">${row.apps}</td>
        <td class="num strong">${row.qty > 0 ? `${fmtQuantity(row.qty)} ${escapeHtml(row.unit)}` : EM}</td>
        ${showPrices ? `<td class="num">${row.cost == null ? EM : fmtBrl(row.cost)}</td>` : ""}
      </tr>`,
    )
    .join("");

  return `
    <div class="headrow">
      <div>
        <p class="kicker">Recomendação técnica · visão geral</p>
        <h1 class="title">${escapeHtml(heading)}</h1>
      </div>
      <div class="stats">
        <div><span>Talhões</span><b>${list.length}</b></div>
        <div><span>Área</span><b>${totalArea > 0 ? `${fmtHectares(totalArea)} ha` : EM}</b></div>
        <div><span>Aplicações</span><b>${appliedOf(allActive)}</b></div>
      </div>
    </div>
    <div class="idgrid id4">
      <div><span class="k">Produtor / cliente</span><span class="v">${escapeHtml(producers.join(", ") || EM)}</span></div>
      <div><span class="k">Fazenda</span><span class="v">${escapeHtml(farmCell)}</span></div>
      <div><span class="k">Cultura</span><span class="v">${escapeHtml(crops.join(", ") || EM)}</span></div>
      <div><span class="k">Safra</span><span class="v">${escapeHtml(safraCell)}</span></div>
    </div>
    <div class="note"><i>i</i><div>Esta folha resume a safra para planejamento e compra. Cada aplicação tem sua receita nas folhas seguintes — destaque e entregue ao operador.</div></div>
    <h2 class="section-title">Cronograma de aplicações</h2>
    <table class="data-table">
      <thead><tr>
        <th>#</th><th>Etapa</th><th>Talhão</th><th>Fase</th><th>Prevista</th><th>Janela</th>
        <th class="num">Calda</th><th>Status</th><th>Receita</th>
      </tr></thead>
      <tbody>${schedule || `<tr><td colspan="9">Nenhuma aplicação para exportar.</td></tr>`}</tbody>
    </table>
    <h2 class="section-title">Talhões</h2>
    <table class="data-table">
      <thead><tr>
        <th>Talhão</th><th>Variedade</th><th>Plantio</th><th>Espaçamento</th>
        <th class="num">Área</th><th class="num">Aplicações</th>
      </tr></thead>
      <tbody>${plots}</tbody>
    </table>
    <h2 class="section-title">Consolidado de produtos <span class="muted">— para compra e logística</span></h2>
    <table class="data-table">
      <thead><tr>
        <th>Produto</th><th>Formulação · classe</th><th class="num">Aplicações</th>
        <th class="num">Quantidade total</th>
        ${showPrices ? `<th class="num">Custo</th>` : ""}
      </tr></thead>
      <tbody>${productRows || `<tr><td colspan="${showPrices ? 5 : 4}">Nenhum produto programado.</td></tr>`}</tbody>
    </table>`;
}

function recipeBody(entry: RecipeEntry, total: number): string {
  const { data, rec } = entry;
  const spec = data.spec ?? {};
  const area = areaHaOf(data);
  const items = sortRecommendationItemsByMixOrder(rec.items);
  const operation = nonSprayOperation(items);
  const spray = operation == null;
  const presc = stagePrescription(rec, area);
  const withTanks = spray && presc.tankCount != null;
  const suggestion = suggestPhenologicalStage(
    spec.crop,
    rec.trigger_type,
    rec.window_start_days,
    rec.window_end_days,
  );
  const stageText = rec.phenological_stage?.trim()
    ? escapeHtml(rec.phenological_stage.trim())
    : escapeHtml(suggestion.stage);
  const predicted = ymdToBr(rec.predicted_date_current);

  const rows = items
    .map((item, index) => {
      const quantities = productQuantities(item.dose_per_hectare, presc, "HA", item.area_factor);
      const unit = totalUnit(item.dose_unit);
      const target = recipeTargetFor(item, index, items.length);
      const meta = itemMeta(item);
      return `<tr>
        <td class="strong">${index + 1}</td>
        <td><span class="strong">${escapeHtml(item.product_name)}</span>${meta ? `<span class="sub">${escapeHtml(meta)}</span>` : ""}</td>
        <td>${target ? escapeHtml(target) : spray ? TODO : EM}${item.area_note ? `<span class="sub">${escapeHtml(item.area_note)}</span>` : ""}</td>
        <td class="num">${fmtDose(item.dose_per_hectare)} ${escapeHtml(doseUnit(item.dose_unit))}</td>
        ${
          withTanks
            ? `<td class="num tk">${quantities.perTank != null ? `${fmtQuantity(quantities.perTank)} ${escapeHtml(unit)}` : EM}</td>
               <td class="num">${quantities.lastTank ? `${fmtQuantity(quantities.lastTank)} ${escapeHtml(unit)}` : EM}</td>`
            : ""
        }
        <td class="num strong">${quantities.total != null ? `${fmtQuantity(quantities.total)} ${escapeHtml(unit)}` : EM}</td>
      </tr>`;
    })
    .join("");

  const cal = spray
    ? `<div class="cal">
        <div><span class="k">Vazão</span><span class="v">${presc.sprayVolumeLHa != null ? `${fmtQuantity(presc.sprayVolumeLHa)} L/ha` : TODO}</span></div>
        <div><span class="k">Calda total</span><span class="v">${presc.totalMixL != null ? `${fmtQuantity(presc.totalMixL)} L` : TODO}</span></div>
        ${
          withTanks
            ? `<div><span class="k">Tanque</span><span class="v">${fmtQuantity(presc.tankCapacityL)} L${presc.haPerTank != null ? `<small>cobre ${fmtHectares(presc.haPerTank)} ha</small>` : ""}</span></div>
               <div><span class="k">Nº de tanques</span><span class="v">${fmtTankCount(presc.tankCount)}<small>${presc.fullTanks} cheio${presc.fullTanks === 1 ? "" : "s"}${presc.lastTankL ? ` + último ${fmtQuantity(presc.lastTankL)} L` : ""}</small></span></div>`
            : ""
        }
        <div><span class="k">Horário</span><span class="v">${rec.application_time?.trim() ? escapeHtml(rec.application_time.trim()) : TODO}</span></div>
        <div><span class="k">Ponta</span><span class="v">${rec.nozzle?.trim() ? escapeHtml(rec.nozzle.trim()) : TODO}</span></div>
      </div>`
    : `<div class="cal cal1"><div><span class="k">Operação</span><span class="v">${escapeHtml(operation)}</span></div></div>`;

  return `
    <div class="headrow">
      <div>
        <p class="kicker">Receita de aplicação · ${entry.n} de ${total}</p>
        <h1 class="title">${escapeHtml(rec.name)}</h1>
        <div class="pills">
          <span class="dark">Talhão ${escapeHtml(data.plotName ?? EM)}</span>
          ${spec.cropLabel ? `<span>${escapeHtml(spec.cropLabel)}</span>` : ""}
          <span>Etapa ${rec.order_index + 1}</span>
          ${triggerLabel(rec.trigger_type) ? `<span>${triggerLabel(rec.trigger_type)}</span>` : ""}
        </div>
      </div>
      <div class="datebox">
        <span class="k">Aplicação prevista</span>
        <div class="when">${predicted ? escapeHtml(predicted) : TODO}</div>
        <div class="win">${escapeHtml(windowFull(rec, data.plantingDate))}</div>
      </div>
    </div>
    <h2 class="section-title">Talhão</h2>
    <div class="idgrid id5">
      <div><span class="k">Área</span><span class="v">${area != null ? fmtHa(area) : EM}</span></div>
      <div><span class="k">Variedade</span><span class="v">${escapeHtml(varietiesOf(data) || EM)}</span></div>
      <div><span class="k">Plantio</span><span class="v">${escapeHtml(ymdToBr(data.plantingDate) ?? EM)}</span></div>
      <div><span class="k">Estádio</span><span class="v">${stageText}</span></div>
      <div><span class="k">Espaçamento</span><span class="v">${
        spec.spacingM != null
          ? `${spec.spacingM.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
          : EM
      }</span></div>
    </div>
    <h2 class="section-title">${spray ? "Calibração e calda" : "Operação"}</h2>
    ${cal}
    <h2 class="section-title">Produtos e doses <span class="muted">— na ordem de mistura</span></h2>
    ${
      items.length
        ? `<table class="rx">
            <thead><tr>
              <th>#</th><th>Produto</th><th>Alvo / observação</th><th class="num">Dose/ha</th>
              ${withTanks ? `<th class="num tk">Por tanque</th><th class="num">Últ. tanque</th>` : ""}
              <th class="num">Total</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`
        : `<p class="empty">Etapa sem produtos.</p>`
    }
    ${rec.notes?.trim() ? `<h2 class="section-title">Observações</h2><p class="obs">${escapeHtml(rec.notes.trim())}</p>` : ""}
    <div class="sign">
      <div><b>${escapeHtml(data.agronomistName ?? "")}</b><span>Responsável técnico · Assinatura</span></div>
      <div><b>____ / ____ / ________</b><span>Data da aplicação</span></div>
    </div>`;
}

function docFooter(left: string): string {
  return `<footer class="footer"><span>${escapeHtml(left)}</span><span>Documento gerado pela plataforma Recomenda</span></footer>`;
}

const UNIFIED_CSS = `
  .headrow { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .title { font-size: 24px; }
  .stats { display: flex; gap: 18px; text-align: right; }
  .stats span { display: block; font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #7a7a70; }
  .stats b { font-size: 16px; font-weight: 650; color: #20201c; }
  .idgrid { display: grid; border: 1px solid #e2e0d6; border-radius: 8px; overflow: hidden; margin-top: 12px; }
  .id4 { grid-template-columns: 1.2fr 1.6fr .8fr .7fr; }
  .id5 { grid-template-columns: repeat(5, 1fr); }
  .idgrid > div { padding: 6px 10px; border-right: 1px solid #e2e0d6; }
  .idgrid > div:last-child { border-right: 0; }
  .k { display: block; font-size: 8px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #8a8a80; }
  .v { display: block; font-size: 12px; font-weight: 650; color: #20201c; margin-top: 1px; }
  .note { margin-top: 12px; background: #eef3ea; border-radius: 6px; padding: 8px 12px; display: flex; gap: 8px; color: #3d4a38; font-size: 11px; }
  .note i { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid #2f6d3f; color: #2f6d3f; font-style: normal; font-weight: 700; font-size: 10px; display: grid; place-items: center; }
  .strong { font-weight: 650; }
  .sub { display: block; font-size: 9.5px; color: #8a8a80; font-weight: 400; }
  .badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: .04em; padding: 2px 6px; border-radius: 4px; background: #f4e6c8; color: #8a5a12; }
  .badge.is-applied-on-time, .badge.is-applied-late { background: #e6f2e9; color: #2f6d3f; }
  .badge.is-overdue { background: #fde8e4; color: #9a3412; }
  .badge.is-skipped { background: #eee; color: #666; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .pills span { border: 1px solid #d9d7cf; border-radius: 5px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
  .pills span.dark { background: #2b2b27; color: #fff; border-color: #2b2b27; }
  .datebox { background: #1c1c1a; color: #fff; border-radius: 6px; padding: 8px 14px; text-align: right; min-width: 160px; }
  .datebox .k { color: #c8c8c0; }
  .datebox .when { font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
  .datebox .win { font-size: 10.5px; color: #d5d5cc; }
  .cal { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .cal1 { grid-template-columns: 1fr; }
  .cal > div { background: #f6f5f0; border-radius: 6px; padding: 8px 10px; }
  .cal .v { font-size: 13px; }
  .cal .v small { display: block; font-size: 10px; font-weight: 500; color: #7a7a70; }
  .todo { color: #b45309; font-weight: 600; }
  .rx { width: 100%; border-collapse: collapse; font-size: 11px; }
  .rx th { background: #f3f2ec; }
  .rx th.tk, .rx td.tk { background: #e7f0e4; }
  .rx td.tk { font-weight: 700; }
  .sign { display: grid; grid-template-columns: 1.4fr 1fr; gap: 40px; margin-top: 28px; page-break-inside: avoid; }
  .sign > div { border-top: 1.5px solid #20201c; padding-top: 6px; }
  .sign b { display: block; font-size: 12.5px; min-height: 1em; }
  .sign span { font-size: 10px; color: #7a7a70; }
  .obs { white-space: pre-line; margin: 0; }
  .idgrid, .cal, .note, .datebox { page-break-inside: avoid; }
`;

export function buildUnifiedExportHtml(
  list: RecommendationShareData[],
  title: string,
  options: { showPrices?: boolean } = {},
): string {
  const entries = recipeEntries(list);
  const showPrices = Boolean(options.showPrices);
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const agronomist = unique(list.map((data) => data.agronomistName))[0];
  const producer = unique(list.map((data) => data.producerName)).join(", ");
  const farm = unique(list.map((data) => data.spec?.farmName)).join(", ");
  const cycle = unique(list.map((data) => data.spec?.cycleName)).join(", ");
  const overviewFooter = ["Recomenda", producer, farm, cycle].filter(Boolean).join(" · ");

  const chunks: string[] = [
    sheetHtml({
      label: "Visão geral",
      header: headerHtml(
        emittedAt,
        null,
        agronomist ? `Responsável técnico: ${agronomist}` : null,
      ),
      footer: docFooter(overviewFooter),
      body: overviewBody(list, entries, showPrices),
    }),
  ];

  for (const entry of entries) {
    const entryPlace = [entry.data.spec?.farmName, entry.data.spec?.farmLocation]
      .filter(Boolean)
      .join(" · ");
    const context = [entry.data.producerName, entryPlace].filter(Boolean).join(" · ");
    chunks.push(
      sheetHtml({
        label: `Receita · ${entry.data.plotName ? `Talhão ${entry.data.plotName} · ` : ""}${entry.rec.name}`,
        header: headerHtml(emittedAt, null, context || null),
        footer: docFooter(
          `Recomenda · Receita ${entry.n} · ${entry.data.plotName ? `Talhão ${entry.data.plotName} · ` : ""}${entry.rec.name}`,
        ),
        pageBreak: true,
        docClass: "recipe",
        body: recipeBody(entry, entries.length),
      }),
    );
  }

  return htmlShell(title, chunks.join(""), UNIFIED_CSS);
}
