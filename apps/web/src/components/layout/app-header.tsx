"use client";

import { usePathname } from "next/navigation";
import {
  BreadcrumbTrail,
  type BreadcrumbItem,
} from "@/components/domain/breadcrumb-back";
import { DashboardGreeting } from "@/components/domain/dashboard-greeting";
import { ProducerSearchButton } from "@/components/domain/producer-search";
import { useBreadcrumbItems } from "./breadcrumbs-context";
import { NotificationsBell } from "./notifications-bell";
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

  // Trilha/saudação à esquerda; slot flex-1 no meio (busca ou espaço vazio)
  // empurra ScopeSwitcher + Notificações + UserMenu para a direita.
  return (
    <header className="px-4 pt-4 pb-2 sm:pt-6 md:px-8">
      <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center gap-2">
        <div className="min-w-0 shrink-0">
          {isHome ? <DashboardGreeting /> : <BreadcrumbTrail items={items} />}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <ProducerSearchButton />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScopeSwitcher />
          <NotificationsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
