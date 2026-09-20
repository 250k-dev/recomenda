/**
 * Documento imprimível (PDF), mensagem de WhatsApp e CSV do estoque do produtor.
 * Mesmo visual dos PDFs de recomendação/lista (print-core).
 */

import {
  escapeHtml,
  fmtBrl,
  footerHtml,
  headerHtml,
  htmlShell,
  printHtml,
  sheetHtml,
} from "../print/print-core";

export interface StockExportItem {
  product_name: string;
  category: string;
  category_label: string;
  quantity: number;
  dose_unit: string;
  price_brl: number | null;
  value_brl: number | null;
}

export interface StockExportData {
  producerName?: string | null;
  agronomistName?: string | null;
  items: StockExportItem[];
  /** PDF kicker / WhatsApp heading. Default: estoque vivo do produtor. */
  heading?: string;
  /** Linha extra no PDF (ex.: data do retrato histórico). */
  note?: string | null;
  csvBasename?: string;
}

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function formatQtyUnit(item: StockExportItem): string {
  const qty = fmtQty(item.quantity);
  return item.dose_unit ? `${qty} ${item.dose_unit}` : qty;
}

/** Suprime colunas de dinheiro mesmo quando os itens trazem preço. */
export interface StockSectionOptions {
  showPrices?: boolean;
}

function summaryHtml(data: StockExportData, opts: StockSectionOptions = {}): string {
  const productCount = data.items.length;
  const totalQty = data.items.reduce((s, r) => s + r.quantity, 0);
  const totalValue = data.items.reduce((s, r) => s + (r.value_brl ?? 0), 0);
  const withPrice = data.items.filter((r) => r.price_brl != null).length;
  const money = opts.showPrices !== false;

  return `<div class="summary">
    <div class="summary-item">
      <span class="summary-label">Produtos</span>
      <span class="summary-value">${productCount}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Qtde total</span>
      <span class="summary-value">${fmtQty(totalQty)}</span>
    </div>
    ${
      money
        ? `<div class="summary-item">
      <span class="summary-label">Valor estimado</span>
      <span class="summary-value">${fmtBrl(totalValue)}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Com preço</span>
      <span class="summary-value">${withPrice}/${productCount}</span>
    </div>`
        : ""
    }
  </div>`;
}

function itemsTableHtml(
  items: StockExportItem[],
  opts: StockSectionOptions = {},
): string {
  if (items.length === 0) {
    return `<p class="empty">Nenhum produto em estoque.</p>`;
  }
  const money = opts.showPrices !== false;

  const rows = items
    .map(
      (it) => `
        <tr>
          <td>${escapeHtml(it.product_name)}</td>
          <td>${escapeHtml(it.category_label || it.category || "—")}</td>
          <td class="num">${escapeHtml(formatQtyUnit(it))}</td>
          ${
            money
              ? `<td class="num">${it.price_brl != null ? fmtBrl(it.price_brl) : "&mdash;"}</td>
          <td class="num">${it.value_brl != null ? fmtBrl(it.value_brl) : "&mdash;"}</td>`
              : ""
          }
        </tr>`,
    )
    .join("");

  const totalValue = items.reduce((s, r) => s + (r.value_brl ?? 0), 0);
  const foot = money
    ? `
    <tr>
      <td colspan="4">Valor estimado total</td>
      <td class="num">${fmtBrl(totalValue)}</td>
    </tr>`
    : "";

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Categoria</th>
          <th class="num">Quantidade</th>
          ${money ? `<th class="num">Preço</th><th class="num">Valor</th>` : ""}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      ${foot ? `<tfoot>${foot}</tfoot>` : ""}
    </table>`;
}

/**
 * Miolo do estoque (resumo + tabela de itens), sem cabeçalho/rodapé nem shell.
 * O PDF do estoque e o Caderno de Safra montam a mesma seção a partir daqui.
 */
export function stockSectionHtml(
  data: StockExportData,
  opts: StockSectionOptions = {},
): string {
  return `${summaryHtml(data, opts)}
    <section>
      <h2 class="section-title">Itens em estoque</h2>
      ${itemsTableHtml(data.items, opts)}
    </section>`;
}

function buildBody(data: StockExportData): string {
  const emittedAt = new Date().toLocaleDateString("pt-BR");
  const heading = data.heading?.trim() || "Estoque";
  const title = data.producerName
    ? `${heading} · ${data.producerName}`
    : heading === "Estoque"
      ? "Estoque do produtor"
      : heading;
  const tags: string[] = [];
  if (data.producerName) {
    tags.push(`<span>Produtor: ${escapeHtml(data.producerName)}</span>`);
  }
  if (data.note) {
    tags.push(`<span>${escapeHtml(data.note)}</span>`);
  }

  return sheetHtml({
    header: headerHtml(emittedAt, heading),
    body: `
    <div class="title-block">
      <p class="kicker">${escapeHtml(heading)}</p>
      <h1 class="title">${escapeHtml(title)}</h1>
      ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
    </div>
    ${stockSectionHtml(data)}`,
    footer: footerHtml(data.agronomistName),
  });
}

export function printStock(data: StockExportData): void {
  printHtml(buildStockHtml(data));
}

export function buildStockHtml(data: StockExportData): string {
  const heading = data.heading?.trim() || "Estoque";
  const title = data.producerName
    ? `${heading} - ${data.producerName}`
    : heading === "Estoque"
      ? "Estoque do produtor"
      : heading;
  return htmlShell(title, buildBody(data));
}

export function buildStockWhatsappMessage(data: StockExportData): string {
  const DIVIDER = "————————————————";
  const productCount = data.items.length;
  const totalValue = data.items.reduce((s, r) => s + (r.value_brl ?? 0), 0);

  const heading = data.heading?.trim() || "ESTOQUE DO PRODUTOR";
  const header: string[] = [`📦 *${heading.toUpperCase()}*`, ""];
  if (data.producerName) header.push(`👤 Produtor: ${data.producerName}`);
  if (data.note) header.push(data.note);
  header.push(`📊 ${productCount} ${productCount === 1 ? "produto" : "produtos"}`);
  if (totalValue > 0) {
    header.push(`💰 Valor estimado: ${fmtBrl(totalValue)}`);
  }

  const body: string[] =
    data.items.length > 0
      ? [
          "📋 *ITENS*",
          data.items
            .map((it) => {
              const bits: string[] = [formatQtyUnit(it)];
              if (it.price_brl != null) bits.push(fmtBrl(it.price_brl));
              if (it.value_brl != null) bits.push(`total ${fmtBrl(it.value_brl)}`);
              return `• *${it.product_name}* — ${bits.join(" · ")}`;
            })
            .join("\n"),
        ]
      : ["_Nenhum produto em estoque._"];

  const footer: string[] = [DIVIDER];
  if (data.agronomistName) {
    footer.push(`👨‍🌾 Responsável técnico: ${data.agronomistName}`);
  }
  footer.push("_Enviado via Recomenda_");

  return [header.join("\n"), body.join("\n\n"), footer.join("\n")].join("\n\n");
}

/** CSV com BOM UTF-8 (Excel BR) — mesma estrutura do export anterior. */
export function downloadStockCsv(
  items: StockExportItem[],
  basename = `estoque-${new Date().toISOString().slice(0, 10)}`,
): void {
  if (typeof window === "undefined") return;

  const header = ["Produto", "Categoria", "Quantidade", "Unidade", "Preço R$", "Valor R$"];
  const lines = [
    header.join(";"),
    ...items.map((r) =>
      [
        r.product_name,
        r.category_label || r.category,
        String(r.quantity).replace(".", ","),
        r.dose_unit,
        r.price_brl != null ? String(r.price_brl).replace(".", ",") : "",
        r.value_brl != null
          ? String(Math.round(r.value_brl * 100) / 100).replace(".", ",")
          : "",
      ]
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(";"),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${basename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
