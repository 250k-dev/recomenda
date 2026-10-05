/**
 * Paginação dos documentos com o Paged.js (prévia A4 na tela e impressão).
 *
 * O navegador sozinho só pagina na hora de imprimir: não dá para mostrar as
 * folhas antes, contar quantas são nem escrever "Folha X de Y". O Paged.js
 * monta as folhas na tela a partir do mesmo HTML. Este CSS adapta as folhas
 * de `sheetHtml` (cabeçalho em <thead>, rodapé em <tfoot>) ao modelo dele:
 * o cabeçalho e o rodapé viram elementos "running" nas margens da página, e
 * o número da folha sai do contador de páginas.
 *
 * Puro (só monta texto). Quem carrega o Paged.js e mede as folhas é o app.
 */

export interface PagedLayout {
  /** Margens do @page (onde ficam cabeçalho e rodapé). */
  margin: string;
  /** Regras extras de @page (páginas nomeadas: capa, paisagem…). */
  extraRules?: string;
  /**
   * CSS aplicado depois de paginar, que o Paged.js não pode reescrever —
   * ex.: o @page nomeado da impressão de uma folha em paisagem (o Paged.js
   * 0.4 só conhece um tamanho de folha por documento).
   */
  lateCss?: string;
}

export const DEFAULT_PAGED_LAYOUT: PagedLayout = { margin: "22mm 14mm 16mm" };

export function buildPagedCss(layout: PagedLayout = DEFAULT_PAGED_LAYOUT): string {
  return `
  @page {
    size: A4;
    margin: ${layout.margin};
    @top-left { content: element(pageHeader); width: 100%; vertical-align: bottom; }
    @bottom-left { content: element(pageFooter); width: 75%; }
    @bottom-right {
      content: "Folha " counter(page) " de " counter(pages);
      font: 10px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #7a7a70;
      vertical-align: middle;
    }
  }
  ${layout.extraRules ?? ""}
  .doc { max-width: none; padding: 0; margin: 0; }
  .doc[style*="page-break-before"] { break-before: page; }
  .sheet, .sheet > thead, .sheet > tbody, .sheet > tfoot,
  .sheet > thead > tr, .sheet > tbody > tr, .sheet > tfoot > tr,
  .sheet > thead > tr > td, .sheet > tbody > tr > td, .sheet > tfoot > tr > td {
    display: block; width: 100%; padding: 0 !important;
  }
  /* O original fica no fluxo com display:none (inline, posto pelo Paged.js);
     só a cópia que vai para a margem vira linha flex. */
  .header { position: running(pageHeader); width: 100%; padding-bottom: 8px; }
  .pagedjs_margin .header {
    display: flex !important; flex-direction: row; align-items: center; justify-content: space-between;
  }
  .pagedjs_margin-top-left > .pagedjs_margin-content { width: 100%; }
  .footer { position: running(pageFooter); margin-top: 0; border-top: 0; padding-top: 0; }
  .footer span:last-child { display: none; }
`;
}

/**
 * CSS de tela da prévia: folhas como cartões empilhados, com o rótulo
 * ("1 Resumo · Talhão C") em cima. Só na tela — a impressão ignora.
 */
export const PAGED_SCREEN_CSS = `
  @media screen {
    html, body { background: transparent !important; }
    body { margin: 0; }
    /* fit-content + margin auto centraliza o bloco sem vazar para a esquerda
       quando o zoom passa da largura do painel; align-items centraliza as
       folhas em retrato quando há uma em paisagem (mais larga) no caderno. */
    .pagedjs_pages { display: flex; flex-direction: column; align-items: center; gap: 30px; width: fit-content; margin: 0 auto; padding: 30px 24px 40px; }
    .pagedjs_page { background: #ffffff; box-shadow: 0 1px 2px rgba(30,28,20,.12), 0 8px 24px rgba(30,28,20,.10); position: relative; overflow: visible; }
    .pagedjs_page::before {
      content: attr(data-preview-label);
      position: absolute; left: 0; top: -22px;
      font: 600 12px Inter, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #55534b; white-space: nowrap;
    }
  }
`;
