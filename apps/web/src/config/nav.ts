import type { Route } from "next";
import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";
import { routes } from "@recomenda/config";

export type NavItem = { label: string; href: Route };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.admin.dashboard },
  { label: "Planos", href: routes.admin.planos },
  { label: "Agrônomos", href: routes.admin.agronomos.lista },
  { label: "Equipes", href: routes.admin.equipes },
  { label: "Membros", href: routes.admin.equipe },
  { label: "Produtores", href: routes.admin.produtores.lista },
  { label: "Produtos", href: routes.admin.catalogoGlobal },
];

/** Admin de organização: escopo da equipe (sem planos da plataforma). */
const ORG_ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.admin.dashboard },
  { label: "Agrônomos", href: routes.admin.agronomos.lista },
  { label: "Membros", href: routes.admin.equipe },
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

// Consultor: equipe da fazenda (Gerente/Operador) + produtores.
const CONSULTANT_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Produtores", href: routes.produtores.lista },
  { label: "Produtos", href: routes.produtos },
  { label: "Equipe", href: routes.equipe.lista },
];

/** Produtor: própria operação (sem carteira de terceiros). */
const PRODUCER_NAV: NavItem[] = [
  { label: "Dashboard", href: routes.dashboard },
  { label: "Cronograma", href: routes.cronograma() },
  { label: "Equipe", href: routes.equipe.lista },
];

/** Navegação por papel + nível de acesso (o nível só importa para STAFF). */
export function navFor(role: UserRole, accessLevel?: AccessLevel | null): NavItem[] {
  switch (role) {
    case "ADMIN":
      return ADMIN_NAV;
    case "ORG_ADMIN":
      return ORG_ADMIN_NAV;
    case "AGRONOMIST":
      return AGRONOMIST_NAV;
    case "PRODUCER":
      return PRODUCER_NAV;
    case "STAFF":
      if (accessLevel === "MANAGER") return MANAGER_NAV;
      if (accessLevel === "FARM_MANAGER") {
        return [
          { label: "Dashboard", href: routes.dashboard },
          { label: "Cronograma", href: routes.cronograma() },
          { label: "Equipe", href: routes.equipe.lista },
        ];
      }
      if (accessLevel === "FARM_OPERATOR") {
        return [
          { label: "Dashboard", href: routes.dashboard },
          { label: "Cronograma", href: routes.cronograma() },
        ];
      }
      return CONSULTANT_NAV;
    default:
      return [];
  }
}
