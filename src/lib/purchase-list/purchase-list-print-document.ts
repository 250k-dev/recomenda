/**
 * Documento imprimível (PDF) e mensagem de WhatsApp da lista de compra completa.
 * Mesmo visual dos PDFs de recomendação (usa o núcleo em print-core).
 */
import type { PurchaseListDetail } from "@/lib/api/purchase-lists";
import { CATEGORY_LABELS } from "@/lib/cost-plan/categories";
import {
  SEED_CATEGORIES,
  seedQuantityUnitLabel,
} from "@/components/domain/season/_shared";
import {
  escapeHtml,
  fmtBrl,
  footerHtml,
  headerHtml,
  htmlShell,
  printHtml,
} from "@/lib/print/print-core";

type PurchaseListItem = PurchaseListDetail["items"][number];

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const categoryLabel = (code: string): string =>
  (CATEGORY_LABELS as Record<string, string>)[code] ?? code;

const isSeedCategory = (category: string) => SEED_CATEGORIES.includes(category);

/** Dose/ha; sementes sem dose usam travessão. */
function formatDose(it: PurchaseListItem): string {
  if (isSeedCategory(it.category) && !(it.dose_per_hectare > 0)) {
    return "—";
  }
  return `${fmtQty(it.dose_per_hectare)} ${it.dose_unit}/ha`;
}

/** Volume a comprar (quantity_to_buy) com unidade adequada. */
function formatVolume(it: PurchaseListItem): string {
  const unit = isSeedCategory(it.category)
    ? seedQuantityUnitLabel(it.category)
    : it.dose_unit;
  return `${fmtQty(it.quantity_to_buy)} ${unit}`;
}

const LIST_CSS = `
  .area-note { display: block; font-size: 9.5px; color: #9a5a16; margin-top: 1px; }
`;

export interface PurchaseListPrintContext {
  producerName?: string | null;
  agronomistName?: string | null;
}

function summaryHtml(list: PurchaseListDetail): string {
  const items: string[] = [];
  items.push(`
    <div class="summary-item">
      <span class="summary-label">Área total</span>
      <span class="summary-value">${fmtQty(list.total_hectares)} ha</span>
    </div>`);
  items.push(`
    <div class="summary-item">
      <span class="summary-label">Talhões</span>
      <span class="summary-value">${(list.plots ?? []).length}</span>
    </div>`);
  if (list.cost_summary) {
    items.push(`
      <div class="summary-item">
        <span class="summary-label">Total de sacas</span>
        <span class="summary-value">${fmtQty(list.cost_summary.total_sacks)}</span>
      </div>`);
    items.push(`
      <div class="summary-item">
        <span class="summary-label">Custo total</span>
        <span class="summary-value">${fmtBrl(list.cost_summary.grand_total_brl)}</span>
      </div>`);
    items.push(`
      <div class="summary-item">
        <span class="summary-label">Custo por ha</span>
        <span class="summary-value">${fmtBrl(list.cost_summary.cost_per_ha_brl)}</span>
      </div>`);
  }
  return `<div class="summary">${items.join("")}</div>`;
}

function itemsTableHtml(list: PurchaseListDetail): string {
  if (list.items.length === 0) {
    return `<p class="empty">Esta lista ainda não tem produtos.</p>`;
  }
  const rows = list.items
    .map((it) => {
      // Produto aplicado em parte da área (ex.: 50% — "áreas sujas"): mostra o
      // percentual e a observação logo abaixo do nome, para o produtor entender
      // por que a quantidade não é a da área toda.
      const partial = it.area_factor != null && it.area_factor > 0 && it.area_factor < 1;
      const areaBits: string[] = [];
      if (partial) areaBits.push(`${fmtQty(it.area_factor * 100)}% da área`);
      if (it.area_note) areaBits.push(escapeHtml(it.area_note));
      const areaLine = areaBits.length
        ? `<span class="area-note">${areaBits.join(" · ")}</span>`
        : "";
      const dose = formatDose(it);
      const volume = formatVolume(it);
      return `
        <tr>
          <td>${escapeHtml(it.product_name)}${areaLine}</td>
          <td>${escapeHtml(categoryLabel(it.category))}</td>
          <td class="num">${dose === "—" ? "&mdash;" : escapeHtml(dose)}</td>
          <td class="num">${escapeHtml(volume)}</td>
          <td class="num">${it.unit_price_brl > 0 ? fmtBrl(it.unit_price_brl) : "&mdash;"}</td>
          <td class="num">${it.total_brl > 0 ? fmtBrl(it.total_brl) : "&mdash;"}</td>
        </tr>`;
    })
    .join("");

  const total = list.cost_summary?.grand_total_brl ?? 0;
  const foot = `
    <tr>
      <td colspan="5">Total estimado</td>
      <td class="num">${fmtBrl(total)}</td>
    </tr>`;

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Categoria</th>
          <th class="num">Dose</th>
          <th class="num">Volume</th>
          <th class="num">Custo unit.</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>${foot}</tfoot>
    </table>`;
}

function buildBody(list: PurchaseListDetail, ctx: PurchaseListPrintContext): string {
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const tags: string[] = [];
  if (ctx.producerName)
    tags.push(`<span>Produtor: ${escapeHtml(ctx.producerName)}</span>`);
  if (list.variety) tags.push(`<span>Variedade: ${escapeHtml(list.variety)}</span>`);

  return `
  <div class="doc">
    ${headerHtml(emittedAt)}
    <div class="title-block">
      <p class="kicker">Lista de compra</p>
      <h1 class="title">${escapeHtml(list.name)}</h1>
      ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
    </div>
    ${summaryHtml(list)}
    <section>
      <h2 class="section-title">Produtos a comprar</h2>
      ${itemsTableHtml(list)}
    </section>
    ${footerHtml(ctx.agronomistName)}
  </div>`;
}

export function printPurchaseList(
  list: PurchaseListDetail,
  ctx: PurchaseListPrintContext = {},
): void {
  printHtml(htmlShell(`Lista de compra - ${list.name}`, buildBody(list, ctx), LIST_CSS));
}

export function buildPurchaseListWhatsappMessage(
  list: PurchaseListDetail,
  ctx: PurchaseListPrintContext = {},
): string {
  const lines: string[] = [];
  lines.push(`*Lista de compra — ${list.name}*`);
  if (ctx.producerName) lines.push(`Produtor: ${ctx.producerName}`);
  lines.push(
    `Área: ${fmtQty(list.total_hectares)} ha · ${(list.plots ?? []).length} talhões`,
  );
  lines.push("");

  lines.push("*Produtos a comprar:*");
  for (const it of list.items) {
    const partial = it.area_factor != null && it.area_factor > 0 && it.area_factor < 1;
    const bits: string[] = [];
    if (partial) bits.push(`${fmtQty(it.area_factor * 100)}% da área`);
    if (it.area_note) bits.push(it.area_note);
    const suffix = bits.length ? ` (${bits.join(" · ")})` : "";
    lines.push(
      `• ${it.product_name} — Dose: ${formatDose(it)} · Volume: ${formatVolume(it)}${suffix}`,
    );
  }

  if (list.cost_summary) {
    lines.push("");
    lines.push(`*Total estimado:* ${fmtBrl(list.cost_summary.grand_total_brl)}`);
  }

  return lines.join("\n");
}
