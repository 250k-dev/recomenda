import type { AccessLevel } from "@recomenda/api/auth-types";
import type { Permission } from "./permissions";

export const FARM_STAFF_GRANT_KEYS = [
  "applications",
  "recommendations",
  "seasons",
  "farms",
  "lists",
  "prices",
  "invite_ops",
] as const;

export type FarmStaffGrantKey = (typeof FARM_STAFF_GRANT_KEYS)[number];

export const FARM_STAFF_GRANT_DEFS: Array<{
  key: FarmStaffGrantKey;
  label: string;
  description: string;
  permissions: Permission[];
  managerOnly?: boolean;
}> = [
  {
    key: "applications",
    label: "Registrar aplicações",
    description: "Marca etapa como aplicada ou pulada.",
    permissions: ["RECOMMENDATION_REGISTER", "EXPORT"],
  },
  {
    key: "recommendations",
    label: "Editar recomendações",
    description: "Troca produto, dose e estrutura das etapas.",
    permissions: ["RECOMMENDATION_EDIT_ITEM", "RECOMMENDATION_EDIT_STRUCTURE"],
  },
  {
    key: "seasons",
    label: "Criar e editar safras",
    description: "Abre safra, programa talhão e publica o cronograma.",
    permissions: ["SEASON_CRUD", "CYCLE_CRUD"],
  },
  {
    key: "farms",
    label: "Adicionar fazendas e talhões",
    description: "Cadastra fazenda e talhão neste produtor.",
    permissions: ["FARM_CREATE", "FARM_EDIT"],
  },
  {
    key: "lists",
    label: "Criar e editar listas de compra",
    description: "Monta e altera a lista de compra da safra.",
    permissions: ["LIST_CRUD"],
  },
  {
    key: "prices",
    label: "Ver preços",
    description: "Valores da lista, cotação e custo por hectare.",
    permissions: ["PRICE_VIEW"],
  },
  {
    key: "invite_ops",
    label: "Convidar operadores",
    description: "Chama outros operadores para a fazenda.",
    permissions: ["FARM_TEAM_MANAGE"],
    managerOnly: true,
  },
];

export function defaultFarmStaffGrantKeys(level: AccessLevel): FarmStaffGrantKey[] {
  if (level === "FARM_OPERATOR") return ["applications"];
  if (level === "FARM_MANAGER") {
    return ["applications", "recommendations", "seasons", "invite_ops"];
  }
  return [];
}

export function permissionsFromGrantKeys(keys: string[]): Permission[] {
  const set = new Set<Permission>();
  const wanted = new Set(keys);
  for (const def of FARM_STAFF_GRANT_DEFS) {
    if (!wanted.has(def.key)) continue;
    for (const p of def.permissions) set.add(p);
  }
  return [...set];
}
