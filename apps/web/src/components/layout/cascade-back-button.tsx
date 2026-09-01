"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { cn } from "@recomenda/utils";
import { type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { useBreadcrumbItems } from "./breadcrumbs-context";

export const HOME_CRUMB: BreadcrumbItem = {
  label: "Início",
  href: "/dashboard",
};

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

function parentOf(items: BreadcrumbItem[]): BreadcrumbItem {
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i]?.href) return items[i];
  }
  return HOME_CRUMB;
}

/** Trilha atual (Início + crumbs da página) e destino do voltar em cascata. */
export function useCascadeNav() {
  const published = useBreadcrumbItems();
  const pathname = usePathname();
  const isHome =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const section = SECTION_LABELS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const items: BreadcrumbItem[] = isHome
    ? []
    : published.length > 0
      ? [HOME_CRUMB, ...published]
      : [HOME_CRUMB, ...(section ? [{ label: section[1] }] : [])];

  return {
    isHome,
    items,
    current: items[items.length - 1],
    parent: parentOf(items),
  };
}

/** Seta para o nível anterior da trilha (igual ao breadcrumb da web). */
export function CascadeBackButton({
  className,
}: {
  className?: string;
}) {
  const { isHome, parent } = useCascadeNav();
  if (isHome) return null;

  return (
    <Button asChild variant="ghost" size="icon-lg" className={cn("shrink-0", className)}>
      <Link href={(parent.href ?? HOME_CRUMB.href) as Route} aria-label="Voltar">
        <ChevronLeft className="size-7" />
      </Link>
    </Button>
  );
}
