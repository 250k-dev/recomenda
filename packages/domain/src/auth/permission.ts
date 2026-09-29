/**
 * Tipo das permissões — arquivo próprio para `farm-staff-grants.ts` e
 * `permissions.ts` não se importarem em ciclo.
 *
 * Espelho no cliente da camada de permissões do backend (`src/common/access`).
 * Serve só para ESCONDER/DESABILITAR botões — a autoridade é sempre o servidor,
 * que revalida cada ação. Mantenha em sincronia com `permissions.map.ts`.
 */
export type Permission =
  | "PRODUCER_CREATE"
  | "PRODUCER_EDIT"
  | "PRODUCER_DELETE"
  | "FARM_CREATE"
  | "FARM_EDIT"
  | "FARM_DELETE"
  | "SEASON_CRUD"
  | "CYCLE_CRUD"
  | "TEMPLATE_CRUD"
  | "RECOMMENDATION_REGISTER"
  | "RECOMMENDATION_EDIT_ITEM"
  | "RECOMMENDATION_EDIT_STRUCTURE"
  | "LIST_CRUD"
  | "QUOTE_CRUD"
  | "STOCK_ADJUST"
  | "CATALOG_CRUD"
  | "HARVEST_REGISTER"
  | "EXPORT"
  | "REPORTS_VIEW"
  | "TEAM_MANAGE"
  | "PRICE_VIEW"
  | "FARM_TEAM_MANAGE";
