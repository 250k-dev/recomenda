"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Tractor,
  CalendarDays,
  ChevronRight,
  MapPin,
  Boxes,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/domain/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgronomistAgenda, useTimingTemplates, queryKeys } from "@/lib/api/hooks";
import { getTimeline, type Recommendation } from "@/lib/api/seasons";
import { getFarmCycles } from "@/lib/api/cycles";
import { getTimingTemplate } from "@/lib/api/templates";
import type { ProducerFarm } from "@/lib/api/client";
import { CROP_LABELS } from "@/lib/season-constants";
import { cn } from "@/lib/utils";

const RUNNING_SEASON_STATUSES = new Set(["PUBLISHED", "IN_PROGRESS"]);

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function isApplied(status: string): boolean {
  return status === "APPLIED_ON_TIME" || status === "APPLIED_LATE";
}

function farmProgressFromTimelines(
  seasonIds: string[],
  timelines: Map<string, Recommendation[]>,
): number | null {
  let done = 0;
  let total = 0;
  for (const seasonId of seasonIds) {
    const recs = timelines.get(seasonId) ?? [];
    total += recs.length;
    done += recs.filter((rec) => isApplied(rec.status)).length;
  }
  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

export function ProducerFarmsSection({
  producerId,
  farms,
  loadingFarms,
  showSeasonActions,
  onNewFarm,
  onOpenRecommendationModels,
}: {
  producerId: string;
  farms: ProducerFarm[];
  loadingFarms: boolean;
  showSeasonActions: boolean;
  onNewFarm: () => void;
  onOpenRecommendationModels?: () => void;
}) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const agenda = useAgronomistAgenda(today, producerId);

  const runningSeasonIds = useMemo(() => {
    const ids: string[] = [];
    for (const farm of farms) {
      for (const season of farm.seasons) {
        if (RUNNING_SEASON_STATUSES.has(season.status)) {
          ids.push(season.id);
        }
      }
    }
    return ids;
  }, [farms]);

  const timelineQueries = useQueries({
    queries: runningSeasonIds.map((seasonId) => ({
      queryKey: queryKeys.seasonTimeline(seasonId),
      queryFn: () => getTimeline(seasonId),
      staleTime: 60_000,
      enabled: showSeasonActions,
    })),
  });

  // Safras (cycles) por fazenda, para o badge "N safras" do card — não dá pra
  // contar `farm.seasons` (uma linha por talhão plantado): uma safra com vários
  // talhões inflava o número.
  const cycleQueries = useQueries({
    queries: farms.map((farm) => ({
      queryKey: queryKeys.farmCycles(farm.id),
      queryFn: () => getFarmCycles(farm.id),
      staleTime: 60_000,
    })),
  });

  const activeCyclesByFarm = useMemo(() => {
    const map = new Map<string, number>();
    farms.forEach((farm, index) => {
      const cycles = cycleQueries[index]?.data ?? [];
      map.set(farm.id, cycles.filter((c) => c.status === "ACTIVE").length);
    });
    return map;
  }, [farms, cycleQueries]);

  const timelinesBySeason = useMemo(() => {
    const map = new Map<string, Recommendation[]>();
    runningSeasonIds.forEach((seasonId, index) => {
      const raw = timelineQueries[index]?.data;
      const rows = (
        Array.isArray(raw)
          ? raw
          : ((raw as { data?: Recommendation[] } | undefined)?.data ?? [])
      ) as Recommendation[];
      map.set(seasonId, rows);
    });
    return map;
  }, [runningSeasonIds, timelineQueries]);

  const upcomingApplications = useMemo(() => {
    const todayYmd = format(today, "yyyy-MM-dd");
    const events = Object.values(agenda.eventsByDay).flat();
    return events
      .filter((event) => event.isLate || event.ymd >= todayYmd)
      .sort((a, b) => {
        if (a.isLate && !b.isLate) return -1;
        if (!a.isLate && b.isLate) return 1;
        return a.ymd.localeCompare(b.ymd);
      })
      .slice(0, 3);
  }, [agenda.eventsByDay, today]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text-strong">
          Fazendas
        </h2>
        <Button variant="clay" size="lg" className="gap-2 shrink-0" onClick={onNewFarm}>
          <Plus className="size-4" />
          Nova fazenda
        </Button>
      </div>

      {loadingFarms ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <Skeleton className="h-40 w-full rounded-xl border border-border" />
            <Skeleton className="h-32 w-full rounded-xl border border-border" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 w-full rounded-xl border border-border" />
            <Skeleton className="h-40 w-full rounded-xl border border-border" />
          </div>
        </div>
      ) : farms.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Tractor className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Nenhuma fazenda cadastrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre a primeira fazenda para iniciar o acompanhamento das safras.
              </p>
            </div>
            <Button size="sm" className="mt-2 gap-1.5" onClick={onNewFarm}>
              <Plus className="size-4" />
              Cadastrar primeira fazenda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            {farms.map((farm) => (
              <FarmCard
                key={farm.id}
                farm={farm}
                producerId={producerId}
                showSeasonActions={showSeasonActions}
                activeCyclesCount={activeCyclesByFarm.get(farm.id) ?? 0}
                progressPct={farmProgressFromTimelines(
                  farm.seasons
                    .filter((season) => RUNNING_SEASON_STATUSES.has(season.status))
                    .map((season) => season.id),
                  timelinesBySeason,
                )}
                onOpen={() =>
                  router.push(
                    `/farms/${farm.id}?producer_id=${encodeURIComponent(producerId)}`,
                  )
                }
              />
            ))}
          </div>

          {showSeasonActions ? (
            <aside className="flex flex-col gap-4">
              <SidebarPanel title="Próximas aplicações">
                {agenda.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : upcomingApplications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma aplicação pendente nos próximos dias.
                  </p>
                ) : (
                  <ul className="divide-y divide-dotted divide-border">
                    {upcomingApplications.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-hover/40"
                          onClick={() => router.push(`/seasons/${event.seasonId}`)}
                        >
                          <span
                            className={cn(
                              "mt-1.5 size-2 shrink-0 rounded-full",
                              event.isLate ? "bg-danger" : "bg-warning",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-strong">
                              {event.applicationTitle}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {event.plotName}
                              {event.farmName ? ` · ${event.farmName}` : ""}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs font-semibold tabular-nums",
                              event.isLate
                                ? "text-danger"
                                : "text-muted-foreground",
                            )}
                          >
                            {event.isLate
                              ? "atrasada"
                              : format(new Date(`${event.ymd}T12:00:00`), "d MMM", {
                                  locale: ptBR,
                                })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SidebarPanel>

              <RecommendationModelsSidebar
                producerId={producerId}
                onOpenRecommendationModels={onOpenRecommendationModels}
              />
            </aside>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SidebarPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-surface-2 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-strong">
          {title}
        </p>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

function FarmCard({
  farm,
  producerId,
  showSeasonActions,
  activeCyclesCount,
  progressPct,
  onOpen,
}: {
  farm: ProducerFarm;
  producerId: string;
  showSeasonActions: boolean;
  activeCyclesCount: number;
  progressPct: number | null;
  onOpen: () => void;
}) {
  const totalHectares = farm.plots.reduce(
    (acc, plot) => acc + (parseFloat(plot.area_hectares) || 0),
    0,
  );

  // Fluxo por safra: a fazenda expõe apenas Safras e Estoque; lista de compra
  // e recomendações vivem dentro de cada safra.
  const farmBase = `/farms/${farm.id}?producer_id=${encodeURIComponent(producerId)}`;
  const seasonsHref = `${farmBase}&tab=seasons`;
  const stockHref = `${farmBase}&tab=stock`;

  const metaParts = [
    farm.location?.trim(),
    `${farm.plots.length} ${farm.plots.length === 1 ? "talhão" : "talhões"}`,
    `${fmtHa(totalHectares)} ha`,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-hover/30"
        onClick={onOpen}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
          <Tractor className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-text-strong">
              {farm.name}
            </span>
            {activeCyclesCount > 0 ? (
              <Badge variant="success" className="shrink-0">
                {activeCyclesCount}{" "}
                {activeCyclesCount === 1 ? "safra" : "safras"}
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            {farm.location ? (
              <MapPin className="size-3.5 shrink-0 text-primary-strong/70" />
            ) : null}
            <span className="truncate">{metaParts.join(" · ")}</span>
          </span>
        </span>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
      </button>

      {showSeasonActions && progressPct != null ? (
        <div className="border-t border-border bg-rail px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-text-strong">
              Progresso das aplicações
            </span>
            <span className="font-semibold tabular-nums text-primary-strong">
              {progressPct}%
            </span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      ) : null}

      {showSeasonActions ? (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Link href={seasonsHref}>
              <CalendarDays className="size-3.5" />
              Safras
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Link href={stockHref}>
              <Boxes className="size-3.5" />
              Estoque
            </Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function RecommendationModelsSidebar({
  producerId,
  onOpenRecommendationModels,
}: {
  producerId: string;
  onOpenRecommendationModels?: () => void;
}) {
  const { data: templates, isLoading } = useTimingTemplates(producerId);
  const templatesList = templates ?? [];
  const visibleTemplates = templatesList.slice(0, 4);

  const templateDetailQueries = useQueries({
    queries: visibleTemplates.map((template) => ({
      queryKey: queryKeys.timingTemplate(template.id),
      queryFn: () => getTimingTemplate(template.id),
      staleTime: 60_000,
    })),
  });

  const stageCountByTemplateId = useMemo(() => {
    const map = new Map<string, number>();
    visibleTemplates.forEach((template, index) => {
      const stages = templateDetailQueries[index]?.data?.stages;
      if (stages?.length) map.set(template.id, stages.length);
    });
    return map;
  }, [visibleTemplates, templateDetailQueries]);

  return (
    <SidebarPanel title="Modelos de recomendação">
      {isLoading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-14 w-full" />
        </div>
      ) : templatesList.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nenhum modelo cadastrado para este produtor.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visibleTemplates.map((template) => {
            const stageCount = stageCountByTemplateId.get(template.id);
            return (
              <li key={template.id}>
                <Link
                  href={`/producers/${producerId}/timing-templates/${template.id}`}
                  className="flex items-start justify-between gap-3 py-3 transition-colors hover:bg-hover/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text-strong">
                      {template.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {CROP_LABELS[template.crop] ?? template.crop}
                      {stageCount != null ? ` · ${stageCount} etapas` : ""}
                    </span>
                  </span>
                  <StatusBadge tone="success" className="shrink-0">
                    Ativo
                  </StatusBadge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {onOpenRecommendationModels ? (
        <div className="border-t border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 w-full justify-start gap-1.5 px-0 text-primary-strong hover:bg-transparent hover:text-primary"
            onClick={onOpenRecommendationModels}
          >
            <Plus className="size-4" />
            Novo modelo
          </Button>
        </div>
      ) : null}
    </SidebarPanel>
  );
}
