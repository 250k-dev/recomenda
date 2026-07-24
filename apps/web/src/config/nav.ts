import type { Route } from "next";
import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";
import { routes } from "@recomenda/config";

export type NavItem = { label: string; href: Route };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.admin.dashboard },
  { label: "Planos", href: routes.admin.planos },
  { label: "Agrônomos", href: routes.admin.agronomos.lista },
  { label: "Equipe", href: routes.admin.equipe },
  { label: "Produtores", href: routes.admin.produtores.lista },
  { label: "Produtos", href: routes.admin.catalogoGlobal },
];

const AGRONOMIST_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Produtores", href: routes.produtores.lista },
  { label: "Produtos", href: routes.produtos },
  { label: "Relatórios", href: routes.relatorios },
  { label: "Equipe", href: routes.equipe.lista },
];

// Gestor: mesma navegação do agrônomo (menos Relatórios, que agrega TODAS as
// fazendas e vazaria escopo), incluindo Equipe (gerencia seus consultores).
const MANAGER_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Produtores", href: routes.produtores.lista },
  { label: "Produtos", href: routes.produtos },
  { label: "Equipe", href: routes.equipe.lista },
];

// Consultor: só acompanha e registra — sem Equipe, sem Relatórios.
const ASSISTANT_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Produtores", href: routes.produtores.lista },
  { label: "Produtos", href: routes.produtos },
];

/** Navegação por papel + nível de acesso (o nível só importa para STAFF). */
export function navFor(role: UserRole, accessLevel?: AccessLevel | null): NavItem[] {
  switch (role) {
    case "ADMIN":
      return ADMIN_NAV;
    case "AGRONOMIST":
      return AGRONOMIST_NAV;
    case "STAFF":
      return accessLevel === "MANAGER" ? MANAGER_NAV : ASSISTANT_NAV;
    default:
      return [];
  }
}
