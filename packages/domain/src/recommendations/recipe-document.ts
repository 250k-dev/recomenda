import type { Recommendation, RecommendationItem } from "@recomenda/api";
import { DOSE_UNIT_SHORT_LABELS, PRODUCT_CATEGORY_LABELS } from "@recomenda/utils";
import { formulationShortLabel, resolveFormulationKey } from "./formulation-mix-order";
import { sortRecommendationItemsByMixOrder } from "./mix-order";
import { suggestPhenologicalStage } from "./phenology";
import {
  computePrescription,
  fmtHectares,
  fmtQuantity,
  fmtTankCount,
  productQuantities,
  type Prescription,
} from "./prescription-calc";
import type { RecommendationShareData } from "./share-message";
import { escapeHtml, footerHtml, headerHtml, htmlShell, printHtml, sheetHtml } from "../print/print-core";

/**
 * Receita de aplicação: UMA folha por etapa × talhão, para o operador levar
 * a campo (o "Relatório do talhão" em print-document.ts é outro documento).
 *
 * Campos que o agrônomo não preencheu saem como "A definir" em destaque —
 * igual à receita manual —, nunca somem: o operador precisa ver que falta.
 */

const TRIGGER_LABELS: Record<string, string> = {
  PRE_PLANTING: "Pré-plantio",
  PLANTING: "Plantio",
  POST_PLANTING: "Pós-plantio",
};

/** Acima disso a tabela de produtos fica compacta para caber em uma folha. */
const DENSE_ITEMS = 12;
const TODO = `<span class="todo">A definir</span>`;

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);
const SEED_UNITS = new Set(["BAG", "SACA"]);

function ymdToBr(value: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Unidade do total (t/ha → t; bag e sacos ficam). */
function totalUnit(unit: string): string {
  const label = (DOSE_UNIT_SHORT_LABELS as Record<string, string>)[unit] ?? unit;
  return label.replace(/\/ha$/, "");
}

/** Unidade da dose (t/ha já é por hectare; o resto é "por ha" pela coluna). */
function doseUnit(unit: string): string {
  return (DOSE_UNIT_SHORT_LABELS as Record<string, string>)[unit] ?? unit;
}

/**
 * Adubação, semente e tratamento de sementes não vão no pulverizador: sem
 * vazão, calda nem tanques. Devolve o nome da operação ou null (pulverização).
 */
export function nonSprayOperation(items: RecommendationItem[]): string | null {
  if (items.length === 0) return null;
  if (items.some((item) => item.category === "FERTILIZER")) return "Adubação";
  const seeds = items.filter(
    (item) => SEED_UNITS.has(item.dose_unit) || item.category === "CULTIVAR_FEIJAO",
  ).length;
  if (seeds === items.length) return "Semeadura";
  const seedTreatment = items.filter((item) => item.category === "SEED_TREATMENT").length;
  if (seeds + seedTreatment >= items.length / 2) return "Tratamento de sementes";
  return null;
}

/** Alvo informado; sem ele, adjuvante e foliar ganham um texto automático. */
export function recipeTargetFor(
  item: RecommendationItem,
  index: number,
  count: number,
): string | null {
  const typed = item.target?.trim();
  if (typed) return typed;
  if (item.category === "ADJUVANT") {
    if (index === 0) return "Primeiro na calda";
    if (index === count - 1) return "Último na calda";
    return "Adjuvante de calda";
  }
  if (item.category === "FOLIAR") return "Nutrição foliar";
  return null;
}

/** Área da receita: a plantada (onde de fato se aplica), senão a cadastral. */
function recipeAreaHa(data: RecommendationShareData): number | null {
  const area = data.spec?.plantedAreaHa ?? data.spec?.areaHa;
  return typeof area === "number" && area > 0 ? area : null;
}

/** Prescrição da etapa: vazão da etapa, tanque da etapa ou da fazenda. */
export function stagePrescription(
  rec: Pick<Recommendation, "spray_volume_l_ha" | "tank_capacity_l">,
  areaHa: number | null,
  farmTankCapacityL?: number | null,
): Prescription {
  return computePrescription({
    areaHa,
    sprayVolumeLHa: rec.spray_volume_l_ha ?? null,
    tankCapacityL: rec.tank_capacity_l ?? farmTankCapacityL ?? null,
  });
}

/** Dose como o agrônomo digitou (0,0523 não vira 0,052): até 4 casas. */
function fmtDose(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function cell(label: string, value: string, cls = ""): string {
  return `<div class="${cls}"><span class="k">${label}</span><span class="v">${value}</span></div>`;
}

function windowLabel(rec: Recommendation, plantingDate: string | null | undefined): string {
  const { window_start_days: ws, window_end_days: we, trigger_type: trigger } = rec;
  if (plantingDate) {
    // Pré-plantio conta para trás do plantio (dias sempre positivos).
    const [from, to] = trigger === "PRE_PLANTING" ? [-we, -ws] : [ws, we];
    const a = ymdToBr(addDays(plantingDate, from))?.slice(0, 5);
    const b = ymdToBr(addDays(plantingDate, to))?.slice(0, 5);
    return a === b ? `Janela ${a}` : `Janela ${a} a ${b}`;
  }
  if (trigger === "PRE_PLANTING") return `${we} a ${ws} dias antes do plantio`;
  if (trigger === "PLANTING") return "No plantio";
  return `${ws} a ${we} dias após o plantio`;
}

function sheetBody(data: RecommendationShareData, rec: Recommendation): string {
  const spec = data.spec ?? {};
  const areaHa = recipeAreaHa(data);
  const items = sortRecommendationItemsByMixOrder(rec.items);
  const operation = nonSprayOperation(items);
  const spray = operation == null;
  const presc = stagePrescription(rec, areaHa, spec.tankCapacityL);
  const withTanks = spray && presc.tankCount != null;

  const suggestion = suggestPhenologicalStage(
    spec.crop,
    rec.trigger_type,
    rec.window_start_days,
    rec.window_end_days,
  );
  const stageText = rec.phenological_stage?.trim()
    ? escapeHtml(rec.phenological_stage.trim())
    : `${escapeHtml(suggestion.stage)}${suggestion.dapLabel ? ` <small>(${suggestion.dapLabel})</small>` : ""}`;

  const predicted = ymdToBr(rec.predicted_date_current);
  const applied = APPLIED.has(rec.status)
    ? `<span class="done">Aplicada${rec.executed_date ? ` em ${ymdToBr(rec.executed_date)}` : ""}</span>`
    : "";
  const varieties = (spec.varieties ?? []).map((v) => v.variety).filter(Boolean).join(", ");

  const appBlock = spray
    ? `<div class="app${withTanks ? " app6" : " app4"}">
        ${cell("Vazão", presc.sprayVolumeLHa != null ? `${fmtQuantity(presc.sprayVolumeLHa)} L/ha` : TODO)}
        ${cell("Calda total", presc.totalMixL != null ? `${fmtQuantity(presc.totalMixL)} L` : TODO)}
        ${
          withTanks
            ? cell(
                "Tanque",
                `${fmtQuantity(presc.tankCapacityL)} L${presc.haPerTank != null ? ` <small>(${fmtHectares(presc.haPerTank)} ha)</small>` : ""}`,
              ) +
              cell(
                "Nº de tanques",
                `${fmtTankCount(presc.tankCount)} <small>${presc.fullTanks} cheio${presc.fullTanks === 1 ? "" : "s"}${
                  presc.lastTankL ? ` + último com ${fmtQuantity(presc.lastTankL)} L` : ""
                }</small>`,
              )
            : ""
        }
        ${cell("Horário", rec.application_time?.trim() ? escapeHtml(rec.application_time.trim()) : TODO)}
        ${cell("Ponta", rec.nozzle?.trim() ? escapeHtml(rec.nozzle.trim()) : TODO)}
      </div>`
    : `<div class="app app1">${cell("Operação", escapeHtml(operation))}</div>`;

  const rows = items
    .map((item, index) => {
      const quantities = productQuantities(item.dose_per_hectare, presc, "HA", item.area_factor);
      const formKey = item.formulation_key ?? resolveFormulationKey(item.equivalence_group);
      const form = formKey && formKey !== "OTHER" ? formulationShortLabel(formKey) : "";
      const category = item.category
        ? ((PRODUCT_CATEGORY_LABELS as Record<string, string>)[item.category] ?? item.category)
        : "";
      const meta = [form, category].filter(Boolean).join(" · ");
      const target = recipeTargetFor(item, index, items.length);
      const factor = item.area_factor ?? 1;
      const unit = totalUnit(item.dose_unit);
      const productArea = areaHa != null ? areaHa * factor : null;
      return `<tr>
        <td class="ix">${index + 1}</td>
        <td><div class="pn">${escapeHtml(item.product_name)}</div>${meta ? `<div class="pm">${escapeHtml(meta)}</div>` : ""}</td>
        <td>${target ? escapeHtml(target) : spray ? TODO : "—"}${item.area_note ? `<div class="pm">${escapeHtml(item.area_note)}</div>` : ""}</td>
        <td class="num">${fmtDose(item.dose_per_hectare)} ${escapeHtml(doseUnit(item.dose_unit))}</td>
        <td class="num muted">${productArea != null ? `${fmtHectares(productArea)} ha` : "—"}${
          factor < 0.999 ? `<div class="pm">${Math.round(factor * 100)}% da área</div>` : ""
        }</td>
        <td class="num tot">${quantities.total != null ? `${fmtQuantity(quantities.total)} ${escapeHtml(unit)}` : "—"}</td>
        ${
          withTanks
            ? `<td class="num">${quantities.perTank != null ? `${fmtQuantity(quantities.perTank)} ${escapeHtml(unit)}` : "—"}</td>
               <td class="num">${quantities.lastTank ? `${fmtQuantity(quantities.lastTank)} ${escapeHtml(unit)}` : "—"}</td>`
            : ""
        }
      </tr>`;
    })
    .join("");

  const body = `
    <div class="rx-head">
      <div class="title-block" style="margin-top:0">
        <p class="kicker">Receita de aplicação</p>
        <h1 class="title">${escapeHtml(rec.name)}</h1>
        <div class="tags">
          ${spec.cropLabel ? `<span>${escapeHtml(spec.cropLabel)}</span>` : ""}
          <span>Etapa ${rec.order_index + 1}</span>
          ${rec.trigger_type && TRIGGER_LABELS[rec.trigger_type] ? `<span>${TRIGGER_LABELS[rec.trigger_type]}</span>` : ""}
          ${applied}
        </div>
      </div>
      <div class="rx-dates">
        ${
          predicted
            ? `Aplicação prevista <b>${predicted}</b>`
            : `<b class="todo">${data.plantingDate ? "Sem data prevista" : "Aguardando data de plantio"}</b>`
        }<br>
        ${escapeHtml(windowLabel(rec, data.plantingDate))}
      </div>
    </div>

    <h2 class="section-title">Identificação</h2>
    <div class="idgrid">
      ${cell("Produtor / cliente", escapeHtml(data.producerName ?? "—"), "s2")}
      ${cell(
        "Fazenda",
        `${escapeHtml(spec.farmName ?? "—")}${spec.farmLocation ? ` <small>· ${escapeHtml(spec.farmLocation)}</small>` : ""}`,
        "s2",
      )}
      ${cell("Talhão", escapeHtml(data.plotName ?? "—"))}
      ${cell("Área", areaHa != null ? `${areaHa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha` : "—")}
      ${cell("Cultura", escapeHtml(spec.cropLabel ?? "—"))}
      ${cell("Safra", escapeHtml(spec.cycleName ?? "—"))}
      ${cell("Variedade", escapeHtml(varieties || "—"))}
      ${cell("Plantio", ymdToBr(data.plantingDate) ?? TODO)}
      ${cell("Estádio fenológico", stageText)}
      ${cell(
        "Espaçamento",
        spec.spacingM != null
          ? `${spec.spacingM.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
          : "—",
      )}
    </div>

    <h2 class="section-title">Dados da aplicação</h2>
    ${appBlock}

    <h2 class="section-title">Produtos e doses <span class="muted sub">— na ordem de mistura</span></h2>
    ${
      items.length
        ? `<table class="rx">
            <thead><tr>
              <th>#</th><th>Produto</th><th>Alvo / observação</th>
              <th class="num">Dose/ha</th><th class="num">Área</th><th class="num">Total</th>
              ${withTanks ? `<th class="num">Por tanque</th><th class="num">Últ. tanque</th>` : ""}
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

  return items.length > DENSE_ITEMS ? `<div class="dense">${body}</div>` : body;
}

const RECIPE_CSS = `
  .sheet > thead > tr > td { padding-top: 8px; padding-bottom: 6px; }
  .sheet > tfoot > tr > td { padding-bottom: 4px; }
  .footer { margin-top: 12px; }
  .title { font-size: 20px; line-height: 1.25; }
  .section-title { margin: 11px 0 6px; font-size: 12.5px; }
  .section-title .sub { font-weight: 400; font-size: 12px; }
  .rx-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-top: 14px; }
  .rx-dates { text-align: right; font-size: 11px; color: #6b6b62; line-height: 1.7; white-space: nowrap; }
  .rx-dates b { color: #20201c; }
  .todo { color: #b45309 !important; font-weight: 600; }
  .tags .done { background: #e6f2e9; border-color: #b9dcc3; color: #2f6d3f; font-weight: 600; }
  .idgrid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #e2e0d6; border-radius: 8px; overflow: hidden; }
  .idgrid > div { padding: 4px 12px; border-right: 1px solid #e2e0d6; border-bottom: 1px solid #e2e0d6; }
  .idgrid .s2 { grid-column: span 2; }
  .k { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #7a7a70; }
  .v { display: block; font-size: 12.5px; font-weight: 600; color: #20201c; margin-top: 1px; }
  .v small { font-weight: 400; color: #7a7a70; font-size: 11px; }
  .app { display: grid; gap: 6px; }
  .app6 { grid-template-columns: 1fr 1.15fr 1.25fr 1.6fr 1fr 1fr; }
  .app4 { grid-template-columns: repeat(4, 1fr); }
  .app1 { grid-template-columns: 1fr; }
  .app > div { border: 1px solid #e2e0d6; background: #faf9f5; border-radius: 8px; padding: 5px 9px; }
  .app .v { font-size: 12px; white-space: nowrap; }
  .app .v small { display: block; font-size: 9.5px; white-space: normal; }
  .rx { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .rx thead th { background: #2f6d3f; color: #fff; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 6px; }
  .rx thead th.num { text-align: right; }
  .rx td { padding: 3px 6px; line-height: 1.3; border-bottom: 1px solid #efeee8; vertical-align: middle; }
  .rx tbody tr:nth-child(even) td { background: #faf9f5; }
  .rx tr { page-break-inside: avoid; }
  .rx .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .rx .ix { color: #2f6d3f; font-weight: 700; width: 16px; }
  .pn { font-weight: 600; color: #20201c; }
  .pm { font-size: 9px; color: #7a7a70; }
  .rx .tot { font-weight: 700; color: #20201c; }
  .app, .idgrid, .sign { page-break-inside: avoid; }
  .obs { font-size: 10.5px; line-height: 1.4; color: #2b2b27; white-space: pre-line; margin: 0; }
  .sign { display: grid; grid-template-columns: 1.5fr 1fr; gap: 32px; margin-top: 22px; }
  .sign > div { border-top: 1.5px solid #20201c; padding-top: 6px; }
  .sign b { display: block; font-size: 12.5px; color: #20201c; min-height: 1em; }
  .sign span { font-size: 10px; color: #7a7a70; }
  .dense .rx td { padding: 2px 6px; font-size: 10px; }
  .dense .rx .pn { display: inline; }
  .dense .rx .pn + .pm { display: inline; margin-left: 6px; }
  .dense .section-title { margin: 9px 0 5px; }
  .dense .sign { margin-top: 16px; }
`;

/** Folhas (etapa × talhão) na ordem recebida; etapa pulada não vira receita. */
export function buildApplicationRecipesHtml(
  datas: RecommendationShareData[],
  title = "Receitas de aplicação",
): string {
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const sheets: string[] = [];
  for (const data of datas) {
    for (const rec of data.recommendations) {
      if (rec.status === "SKIPPED") continue;
      sheets.push(
        sheetHtml({
          header: headerHtml(emittedAt),
          body: sheetBody(data, rec),
          footer: footerHtml(data.agronomistName),
          pageBreak: sheets.length > 0,
        }),
      );
    }
  }
  return htmlShell(title, sheets.join(""), RECIPE_CSS);
}

export function countApplicationRecipes(datas: RecommendationShareData[]): number {
  return datas.reduce(
    (sum, data) => sum + data.recommendations.filter((rec) => rec.status !== "SKIPPED").length,
    0,
  );
}

export function printApplicationRecipes(datas: RecommendationShareData[], title?: string): void {
  printHtml(buildApplicationRecipesHtml(datas, title));
}
