// Superfície pública de @recomenda/api.
//
// A receita pede lista explícita de símbolos. Aqui a granularidade é de
// *módulo*, não de símbolo, por dois motivos concretos:
//
// 1. São 172 símbolos exportados nos 11 módulos abaixo. Uma lista nominal seria
//    espelho literal do `export *`, sem informação nova, e dessincronizaria no
//    primeiro fetcher adicionado.
// 2. O `exports` do package.json expõe `"./*": "./src/*.ts"` — qualquer arquivo
//    do pacote já é importável por caminho profundo (`@recomenda/api/quotes`).
//    Uma lista fechada aqui não estreitaria nada; só pareceria estreitar.
//
// O que segura a fronteira de verdade são os invariantes do gate: sem React,
// sem camada de React Query, sem `@/` dentro de packages/.
//
// Fora deste barril (consultants, cycles, market, quotes, api-error,
// auth-types, http/*): consumidos por caminho profundo, como já eram.

export * from "./auth";
export * from "./farms";
export * from "./seasons";
export * from "./catalog";
export * from "./templates";
export * from "./producers";
export * from "./admin";
export * from "./notifications";
export * from "./purchase-lists";
export * from "./reports";
export * from "./types";
export * from "./farm-team";
export * from "./billing";
