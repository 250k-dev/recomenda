/**
 * Runtime da paginação (Paged.js) — só no navegador.
 *
 * Pega o HTML de um documento (relatório, receitas, caderno), injeta o CSS de
 * paginação e o Paged.js, e devolve, por `postMessage`, quantas folhas saíram
 * e o rótulo de cada uma. A mesma saída serve para a prévia (folhas na tela)
 * e para a impressão (o Paged.js também cuida do @media print).
 */
import {
  buildPagedCss,
  DEFAULT_PAGED_LAYOUT,
  PAGED_SCREEN_CSS,
  type PagedLayout,
} from "@recomenda/domain/print/paged";

export const PAGED_SCRIPT_SRC = "/vendor/paged-0.4.3.polyfill.min.js";
const MESSAGE_TYPE = "recomenda-paged";

export interface PagedPage {
  /** Rótulo da folha ("Receita · Talhão C · Fungicida R1"). */
  label: string;
  /** Seção do caderno (data-section), quando houver. */
  section: string | null;
}

export interface PagedResult {
  channel: string;
  total: number;
  pages: PagedPage[];
}

/** HTML pronto para o Paged.js. `channel` identifica a resposta. */
export function pagedDocumentHtml(
  html: string,
  channel: string,
  layout: PagedLayout = DEFAULT_PAGED_LAYOUT,
): string {
  const head = `
<style>${buildPagedCss(layout)}</style>
<script>
  window.PagedConfig = {
    auto: true,
    after: function (flow) {
      // CSS de tela entra só depois de paginar: o Paged.js reprocessa os
      // <style> do documento e descartava o @media screen (folhas encostadas
      // à esquerda, sem o rótulo de cada folha).
      var late = ${JSON.stringify(PAGED_SCREEN_CSS)} + ${JSON.stringify(layout.lateCss ?? "")};
      if (late) {
        var style = document.createElement("style");
        style.textContent = late;
        document.head.appendChild(style);
      }
      var pages = Array.prototype.slice.call(document.querySelectorAll(".pagedjs_page"));
      var out = pages.map(function (page, index) {
        var labelled = page.querySelector("[data-label]");
        var section = page.querySelector("[data-section]");
        var label = labelled ? labelled.getAttribute("data-label") : "";
        page.setAttribute("data-preview-label", (index + 1) + "   " + (label || ""));
        return { label: label || "", section: section ? section.getAttribute("data-section") : null };
      });
      parent.postMessage({ type: ${JSON.stringify(MESSAGE_TYPE)}, channel: ${JSON.stringify(channel)}, total: flow.total, pages: out }, "*");
    }
  };
</script>
<script src="${PAGED_SCRIPT_SRC}"></script>`;
  return html.includes("</head>") ? html.replace("</head>", `${head}</head>`) : head + html;
}

/** Escuta a resposta do iframe com aquele `channel`. Devolve o "desligar". */
export function onPaged(channel: string, handler: (result: PagedResult) => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as Partial<PagedResult> & { type?: string };
    if (data?.type !== MESSAGE_TYPE || data.channel !== channel) return;
    handler({ channel, total: data.total ?? 0, pages: data.pages ?? [] });
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

let seq = 0;
export function newPagedChannel(prefix = "doc"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/**
 * Imprime um documento já paginado (sem prévia na tela): monta num iframe
 * fora da tela, espera o Paged.js terminar e abre o "Salvar como PDF".
 */
export function printPaged(html: string, layout?: PagedLayout): void {
  if (typeof window === "undefined") return;
  const channel = newPagedChannel("print");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  // Fora da tela, mas com tamanho: o Paged.js mede as folhas para paginar.
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:1000px;height:1200px;border:0;";
  const cleanup = () =>
    window.setTimeout(() => {
      stop();
      iframe.remove();
    }, 1000);
  const stop = onPaged(channel, () => {
    const frame = iframe.contentWindow;
    if (!frame) return cleanup();
    frame.onafterprint = cleanup;
    frame.focus();
    frame.print();
    window.setTimeout(cleanup, 60000);
  });
  iframe.srcdoc = pagedDocumentHtml(html, channel, layout);
  document.body.appendChild(iframe);
}
