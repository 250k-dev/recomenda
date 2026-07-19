import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";

/**
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
  | "TEAM_MANAGE";

const MANAGER_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "PRODUCER_CREATE",
  "PRODUCER_EDIT",
  "PRODUCER_DELETE",
  "FARM_CREATE",
  "FARM_EDIT",
  "FARM_DELETE",
  "SEASON_CRUD",
  "CYCLE_CRUD",
  "TEMPLATE_CRUD",
  "RECOMMENDATION_REGISTER",
  "RECOMMENDATION_EDIT_ITEM",
  "RECOMMENDATION_EDIT_STRUCTURE",
  "LIST_CRUD",
  "QUOTE_CRUD",
  "STOCK_ADJUST",
  "CATALOG_CRUD",
  "HARVEST_REGISTER",
  "EXPORT",
  "REPORTS_VIEW",
  "TEAM_MANAGE",
]);

const ASSISTANT_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "RECOMMENDATION_REGISTER",
  "RECOMMENDATION_EDIT_ITEM",
  "EXPORT",
]);

const ACCESS_LEVEL_PERMISSIONS: Record<AccessLevel, ReadonlySet<Permission>> = {
  MANAGER: MANAGER_PERMISSIONS,
  ASSISTANT: ASSISTANT_PERMISSIONS,
};

export type Principal = { role?: UserRole | null; access_level?: AccessLevel | null };

/**
 * A camada de níveis só se aplica ao membro de equipe (STAFF). Admin/Agrônomo/
 * Produtor não são filtrados por ela no cliente (o servidor cuida do escopo).
 */
export function can(user: Principal | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "STAFF") {
    const level = user.access_level ?? "ASSISTANT";
    return ACCESS_LEVEL_PERMISSIONS[level].has(permission);
  }
  return true;
}

/** É Gestor (STAFF + MANAGER)? */
export function isManager(user: Principal | null | undefined): boolean {
  return user?.role === "STAFF" && (user.access_level ?? "ASSISTANT") === "MANAGER";
}

/** É Consultor (STAFF + ASSISTANT)? */
export function isAssistant(user: Principal | null | undefined): boolean {
  return user?.role === "STAFF" && (user.access_level ?? "ASSISTANT") === "ASSISTANT";
}
