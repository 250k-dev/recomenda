"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePublishSeason } from "@recomenda/api-hooks";
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
  const { seasonId, season, statusLabel, breadcrumbs, hrefs } = useSeasonPage();
  const publishMutation = usePublishSeason(seasonId || "");

  const activeTab = pathname.endsWith("/plano-de-custo")
    ? "plano-de-custo"
    : pathname.endsWith("/historico-do-talhao")
      ? "historico-do-talhao"
      : "cronograma";

  const handlePublish = () => {
    publishMutation.mutate([], {
      onSuccess: () => toast.success("Safra publicada com sucesso!"),
      onError: (error: unknown) => {
        const msg =
          error instanceof Error ? error.message : "Falha ao publicar safra";
        toast.error(`Erro: ${msg || "Falha ao publicar safra"}`);
      },
    });
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
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

        <div className="flex items-center gap-2">
          {season?.status ? (
            <Badge variant={STATUS_VARIANTS[season.status] || "default"}>
              {statusLabel}
            </Badge>
          ) : null}
          {season?.status === "DRAFT" && activeTab === "cronograma" ? (
            <Button
              size="sm"
              className="gap-2"
              onClick={handlePublish}
              disabled={publishMutation.isPending}
            >
              <Send className="w-4 h-4" />
              {publishMutation.isPending ? "Publicando..." : "Publicar safra"}
            </Button>
          ) : null}
        </div>
      </div>

      {children}
    </>
  );
}
