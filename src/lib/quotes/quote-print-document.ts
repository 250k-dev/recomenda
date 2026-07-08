/**
 * Documento imprimível (PDF) e mensagem de WhatsApp das cotações das lojas.
 * Mesmo visual dos PDFs de recomendação (usa o núcleo em print-core).
 */
import type {
  QuoteComparison,
  QuoteComparisonResponse,
  QuoteComparisonResponseItem,
  QuotePaymentTerm,
} from "@/lib/api/quotes";
import {
  escapeHtml,
  fmtBrl,
  footerHtml,
  headerHtml,
  htmlShell,
  printHtml,
} from "@/lib/print/print-core";

const TERM_LABEL: Record<QuotePaymentTerm, string> = {
  CASH: "à vista",
  TERM: "a prazo",
};

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export interface QuotePrintContext {
  listName?: string | null;
  producerName?: string | null;
  agronomistName?: string | null;
}

const QUOTE_CSS = `
  .cmp { font-size: 10.5px; }
  .cmp th, .cmp td { padding: 5px 6px; }
  .cell-term { display: block; font-size: 8.5px; color: #7a7a70; text-transform: uppercase; letter-spacing: 0.04em; }
  .cell-sub { display: block; font-size: 9px; color: #9a5a16; }
`;

function effPrice(cell: QuoteComparisonResponseItem): number | null {
  return cell.unit_price_brl ?? cell.substitute_unit_price_brl ?? null;
}

/** Menor preço efetivo por item + lojas que o oferecem (entre as selecionadas). */
function computeCheapest(
  items: QuoteComparison["items"],
  responses: QuoteComparisonResponse[],
) {
  const cheapest = new Map<string, number>();
  const bestStores = new Map<string, string[]>();
  for (const it of items) {
    let min = Infinity;
    for (const r of responses) {
      const cell = r.items.find(
        (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
      );
      const eff = cell ? effPrice(cell) : null;
      if (eff != null && eff < min) min = eff;
    }
    if (min !== Infinity) {
      cheapest.set(it.purchase_list_item_id, min);
      bestStores.set(
        it.purchase_list_item_id,
        responses
          .filter((r) => {
            const cell = r.items.find(
              (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
            );
            const eff = cell ? effPrice(cell) : null;
            return eff != null && eff <= min;
          })
          .map((r) => r.store_name),
      );
    }
  }
  return { cheapest, bestStores };
}

function selectResponses(
  data: QuoteComparison,
  storeIds: Set<string> | null,
): QuoteComparisonResponse[] {
  return data.responses.filter((r) => storeIds == null || storeIds.has(r.id));
}

function titleTags(ctx: QuotePrintContext): string {
  const tags: string[] = [];
  if (ctx.producerName)
    tags.push(`<span>Produtor: ${escapeHtml(ctx.producerName)}</span>`);
  return tags.length ? `<div class="tags">${tags.join("")}</div>` : "";
}

function buildComparisonBody(
  data: QuoteComparison,
  responses: QuoteComparisonResponse[],
  ctx: QuotePrintContext,
): string {
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const { cheapest, bestStores } = computeCheapest(data.items, responses);

  const cheapestTotal = Math.min(
    ...responses.map((r) => (r.total_brl > 0 ? r.total_brl : Infinity)),
  );

  const head = `
    <tr>
      <th>Produto</th>
      <th class="num">Qtd</th>
      <th>Melhor preço</th>
      ${responses.map((r) => `<th class="num">${escapeHtml(r.store_name)}</th>`).join("")}
    </tr>`;

  const rows = data.items
    .map((it) => {
      const best = cheapest.get(it.purchase_list_item_id) ?? null;
      const bestCell =
        best != null
          ? `<span class="best">${fmtBrl(best)}</span><span class="cell-sub muted" style="color:#7a7a70">${escapeHtml((bestStores.get(it.purchase_list_item_id) ?? []).join(", "))}</span>`
          : "&mdash;";
      const storeCells = responses
        .map((r) => {
          const cell = r.items.find(
            (ci) => ci.purchase_list_item_id === it.purchase_list_item_id,
          );
          if (!cell) return `<td class="num muted">&mdash;</td>`;
          const eff = effPrice(cell);
          const isBest = eff != null && best != null && eff <= best;
          if (eff == null && cell.availability === "UNAVAILABLE") {
            return `<td class="num muted">Não tem</td>`;
          }
          if (eff == null) return `<td class="num muted">&mdash;</td>`;
          const term = cell.payment_term
            ? `<span class="cell-term">${TERM_LABEL[cell.payment_term]}</span>`
            : "";
          const sub = cell.substitute_product_name
            ? `<span class="cell-sub">↪ ${escapeHtml(cell.substitute_product_name)}</span>`
            : "";
          return `<td class="num${isBest ? " best" : ""}">${fmtBrl(eff)}${term}${sub}</td>`;
        })
        .join("");
      return `
        <tr>
          <td>${escapeHtml(it.product_name)}<span class="cell-term">${escapeHtml(it.stage ?? "")}</span></td>
          <td class="num">${fmtQty(it.quantity_to_buy)} ${escapeHtml(it.dose_unit)}</td>
          <td>${bestCell}</td>
          ${storeCells}
        </tr>`;
    })
    .join("");

  const totalCells = responses
    .map((r) => {
      const isBest = r.total_brl > 0 && r.total_brl <= cheapestTotal;
      return `<td class="num${isBest ? " best" : ""}">${r.total_brl > 0 ? fmtBrl(r.total_brl) : "&mdash;"}</td>`;
    })
    .join("");

  const foot = `
    <tr>
      <td>Total estimado</td>
      <td></td>
      <td>${Number.isFinite(cheapestTotal) && cheapestTotal > 0 ? `<span class="best">${fmtBrl(cheapestTotal)}</span>` : "&mdash;"}</td>
      ${totalCells}
    </tr>`;

  const table =
    responses.length > 0 && data.items.length > 0
      ? `<table class="data-table cmp">
          <thead>${head}</thead>
          <tbody>${rows}</tbody>
          <tfoot>${foot}</tfoot>
        </table>`
      : `<p class="empty">Sem cotações para exibir.</p>`;

  return `
  <div class="doc">
    ${headerHtml(emittedAt)}
    <div class="title-block">
      <p class="kicker">Comparação de cotações</p>
      <h1 class="title">${escapeHtml(ctx.listName || "Cotações das lojas")}</h1>
      ${titleTags(ctx)}
    </div>
    <section>
      <h2 class="section-title">Preços por loja (${responses.length} ${responses.length === 1 ? "loja" : "lojas"})</h2>
      ${table}
    </section>
    ${footerHtml(ctx.agronomistName)}
  </div>`;
}

export function printQuoteComparison(
  data: QuoteComparison,
  storeIds: Set<string> | null,
  ctx: QuotePrintContext = {},
): void {
  const responses = selectResponses(data, storeIds);
  const title = `Cotações - ${ctx.listName || "lojas"}`;
  printHtml(htmlShell(title, buildComparisonBody(data, responses, ctx), QUOTE_CSS));
}

/** Mensagem textual para WhatsApp: melhores preços por item + total por loja. */
export function buildQuoteWhatsappMessage(
  data: QuoteComparison,
  storeIds: Set<string> | null,
  ctx: QuotePrintContext = {},
): string {
  const responses = selectResponses(data, storeIds);
  const { cheapest, bestStores } = computeCheapest(data.items, responses);

  const lines: string[] = [];
  lines.push(`*Cotações — ${ctx.listName || "lojas"}*`);
  if (ctx.producerName) lines.push(`Produtor: ${ctx.producerName}`);
  lines.push("");

  lines.push("*Melhores preços:*");
  for (const it of data.items) {
    const best = cheapest.get(it.purchase_list_item_id);
    if (best == null) continue;
    const stores = (bestStores.get(it.purchase_list_item_id) ?? []).join(", ");
    lines.push(`• ${it.product_name}: ${fmtBrl(best)}${stores ? ` (${stores})` : ""}`);
  }

  const withTotal = responses.filter((r) => r.total_brl > 0);
  if (withTotal.length > 0) {
    lines.push("");
    lines.push("*Total por loja:*");
    for (const r of [...withTotal].sort((a, b) => a.total_brl - b.total_brl)) {
      lines.push(`• ${r.store_name}: ${fmtBrl(r.total_brl)}`);
    }
  }

  return lines.join("\n");
}
