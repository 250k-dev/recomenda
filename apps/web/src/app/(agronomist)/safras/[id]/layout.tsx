"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { Badge } from "@recomenda/ui/primitives/badge";
import { useSeasonPage } from "@/components/domain/season/use-season-page";
import { cn, STATUS_VARIANTS } from "@recomenda/utils";

/**
 * Moldura das telas da safra do talhão: breadcrumb + navegação entre as
 * subrotas (Cronograma / Plano de custo / Histórico do talhão). Cada aba de
 * antes (`?tab=`) agora é uma rota própria; a ativa vem do pathname.
 */
export default function SeasonDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Sem botão de publicar aqui: a programação do talhão é publicada pela
  // safra ("Revisar e publicar"), que aplica a trava de compra da safra toda.
  const { season, statusLabel, breadcrumbs, hrefs } = useSeasonPage();

  const activeTab = pathname.endsWith("/plano-de-custo")
    ? "plano-de-custo"
    : pathname.endsWith("/historico-do-talhao")
      ? "historico-do-talhao"
      : "cronograma";

  const tabs = [
    { value: "cronograma", label: "Cronograma", href: hrefs.cronograma },
    {
      value: "plano-de-custo",
      label: "Plano de custo",
      href: hrefs.planoDeCusto,
    },
    {
      value: "historico-do-talhao",
      label: "Histórico do talhão",
      href: hrefs.historicoDoTalhao,
    },
  ] as const;

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      {/* Navegação entre as telas da safra */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
            {tabs.map(({ value, label, href }) => (
            <Link
              key={value}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {season?.status ? (
            <Badge variant={STATUS_VARIANTS[season.status] || "default"}>
              {statusLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      {children}
    </>
  );
}
