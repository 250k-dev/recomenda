"use client";

// Superfície pública de @recomenda/api-hooks — a camada React Query da
// Recomenda. Cada módulo abaixo casa com um módulo de fetchers de
// `@recomenda/api`; o que este pacote acrescenta é cache, invalidação e o
// estado de cliente que só existe no browser.
//
// Ao contrário de `domain`, aqui a lista é por módulo (`export *`), como em
// `api`: são hooks que crescem junto com cada fetcher novo, e a lista nominal
// seria espelho do arquivo. Quem segura a fronteira são os greps do gate.
//
// Regra do pacote: todo arquivo que exporta hook é "use client". O QueryClient
// NÃO mora aqui — é composição de aplicação, fica no provider de apps/web.

// `queryKeys` vem nomeado e primeiro de propósito: é o que garante invalidação
// correta de cache, e o app precisa dele para invalidações manuais. Não pode
// ficar acessível só por caminho profundo.
export { queryKeys } from "./queryKeys";

// ---- hooks de dados (um módulo por recurso da API) ---------------------
export * from "./auth";
export * from "./farms";
export * from "./cycles";
export * from "./seasons";
export * from "./catalog";
export * from "./templates";
export * from "./producers";
export * from "./admin";
export * from "./notifications";
export * from "./purchase-lists";
export * from "./portfolio-price-coverage";
export * from "./quotes";
export * from "./reports";
export * from "./agenda";
export * from "./consultants";

// ---- gates de permissão na UI -----------------------------------------
// Espelho visual de `can()` de @recomenda/domain; o servidor é a autoridade.
export { usePrincipal, useCan } from "./use-can";

// ---- estado de cliente ------------------------------------------------
// O store de impersonation mora aqui, e não em apps/web/src/stores, porque
// `useImpersonateProducer`/`useExitImpersonation` escrevem nele: deixá-lo no
// app faria este pacote importar de `apps/`. Ver handoff/A5.md.
export { useImpersonationStore } from "./impersonation-store";

// ---- rede de segurança de formulário longo ----------------------------
export {
  useLocalDraft,
  readLocalDraft,
  writeLocalDraft,
  clearLocalDraft,
} from "./use-local-draft";
export { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";
