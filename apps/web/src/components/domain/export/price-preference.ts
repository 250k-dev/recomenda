/**
 * Lembra a escolha "incluir preços no documento" entre exports.
 *
 * É só conveniência de UI — quem manda é a permissão `PRICE_VIEW`: sem ela o
 * payload chega sem preço e o documento sai sem valores, marcado ou não.
 */
const KEY = "recomenda:export:show-prices";

export function readPricePreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Padrão marcado: quem tem permissão costuma entregar o custo ao produtor.
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function writePricePreference(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // localStorage indisponível (aba anônima, cota) — a escolha vale só nesta tela.
  }
}
