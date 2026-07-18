"use client";

import { usePathname } from "next/navigation";
import {
  BreadcrumbTrail,
  type BreadcrumbItem,
} from "@/components/domain/breadcrumb-back";
import { DashboardGreeting } from "@/components/domain/dashboard-greeting";
import { ProducerSearchButton } from "@/components/domain/producer-search";
import { useBreadcrumbItems } from "./breadcrumbs-context";
import { UserMenu } from "./user-menu";

// Raiz de toda trilha na área do agrônomo: o Dashboard, rotulado "Início".
const HOME: BreadcrumbItem = { label: "Início", href: "/dashboard" };

// Rótulo da seção quando a página não publica breadcrumbs próprios.
const SECTION_LABELS: Array<[prefix: string, label: string]> = [
  ["/producers", "Produtores"],
  ["/catalog", "Produtos"],
  ["/reports", "Relatórios"],
  ["/consultants", "Equipe"],
  ["/profile", "Perfil"],
  ["/farms", "Fazendas"],
  ["/seasons", "Safras"],
  ["/cronograma", "Cronograma"],
  ["/compra-templates", "Templates de compra"],
];

export function AppHeader() {
  const published = useBreadcrumbItems();
  const pathname = usePathname();

  // No próprio Dashboard não há trilha (ele é a raiz): a saudação ocupa o
  // lugar dela; nas demais páginas o Início é a raiz e a página completa a
  // trilha (breadcrumbs ou rótulo da seção).
  const isHome =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const section = SECTION_LABELS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const items: BreadcrumbItem[] = isHome
    ? []
    : published.length > 0
      ? [HOME, ...published]
      : [HOME, ...(section ? [{ label: section[1] }] : [])];

  // Trilha/saudação com largura natural e prioridade sobre a busca: a busca
  // (flex-1) fica com a sobra da linha e decide sozinha, por container query,
  // se cabe como input ou recolhe para ícone.
  return (
    <header className="px-4 pt-5 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-2">
        <div className="min-w-0">
          {isHome ? <DashboardGreeting /> : <BreadcrumbTrail items={items} />}
        </div>
        <ProducerSearchButton />
        <div className="shrink-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
