"use client";

import { usePathname } from "next/navigation";
import {
  BreadcrumbTrail,
  type BreadcrumbItem,
} from "@/components/domain/breadcrumb-back";
import { DashboardGreeting } from "@/components/domain/dashboard-greeting";
import { ProducerSearchButton } from "@/components/domain/producer-search";
import { useBreadcrumbItems } from "./breadcrumbs-context";
import { ScopeSwitcher } from "./scope-switcher";
import { UserMenu } from "./user-menu";

// Raiz de toda trilha na área do agrônomo: o Dashboard, rotulado "Início".
const HOME: BreadcrumbItem = { label: "Início", href: "/dashboard" };

// Rótulo da seção quando a página não publica breadcrumbs próprios.
const SECTION_LABELS: Array<[prefix: string, label: string]> = [
  ["/produtores", "Produtores"],
  ["/minhas-gestoes", "Minhas Gestões"],
  ["/produtos", "Produtos"],
  ["/relatorios", "Relatórios"],
  ["/equipe", "Equipe"],
  ["/perfil", "Perfil"],
  ["/fazendas", "Fazendas"],
  ["/safras", "Safras"],
  ["/cronograma", "Cronograma"],
  ["/templates-de-compra", "Templates de compra"],
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
  // se cabe como input ou recolhe para ícone. O min-h dá um piso à linha para
  // que a trilha (uma linha) não deixe o header mais baixo que a saudação (duas).
  return (
    <header className="px-4 pt-4 pb-2 sm:pt-6 md:px-8">
      <div className="flex items-center w-full gap-2 mx-auto min-h-14 max-w-7xl">
        <div className="min-w-0">
          {isHome ? <DashboardGreeting /> : <BreadcrumbTrail items={items} />}
        </div>
        <ProducerSearchButton />
        <div className="shrink-0">
          <ScopeSwitcher />
        </div>
        <div className="shrink-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
