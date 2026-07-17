import type { AccessLevel, UserRole } from "@/types/auth";

export type NavItem = { label: string; href: string };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Planos", href: "/admin/plans" },
  { label: "Agrônomos", href: "/admin/agronomists" },
  { label: "Produtores", href: "/admin/producers" },
  { label: "Produtos", href: "/admin/global-catalog" },
];

const AGRONOMIST_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Produtores", href: "/producers" },
  { label: "Produtos", href: "/catalog" },
  { label: "Relatórios", href: "/reports" },
  { label: "Equipe", href: "/consultants" },
];

// Gestor: mesma navegação do agrônomo (menos Relatórios, que agrega TODAS as
// fazendas e vazaria escopo), incluindo Equipe (gerencia seus consultores).
const MANAGER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Produtores", href: "/producers" },
  { label: "Produtos", href: "/catalog" },
  { label: "Equipe", href: "/consultants" },
];

// Consultor: só acompanha e registra — sem Equipe, sem Relatórios.
const ASSISTANT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Produtores", href: "/producers" },
  { label: "Produtos", href: "/catalog" },
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
