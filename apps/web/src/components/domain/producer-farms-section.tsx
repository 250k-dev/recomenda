"use client";

import { routes } from "@recomenda/config";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, MapPin, Plus, Tractor } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { queryKeys } from "@recomenda/api-hooks";
import { getTimeline, type Recommendation } from "@recomenda/api/seasons";
import { getFarmCycles } from "@recomenda/api/cycles";
import type { ProducerFarm } from "@recomenda/api";
import { useCan } from "@recomenda/api-hooks/use-can";

const RUNNING_SEASON_STATUSES = new Set(["PUBLISHED", "IN_PROGRESS"]);

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function isApplied(status: string): boolean {
  return status === "APPLIED_ON_TIME" || status === "APPLIED_LATE";
}

type FarmProgress = { done: number; total: number; pct: number };

function farmProgressFromTimelines(
  seasonIds: string[],
  timelines: Map<string, Recommendation[]>,
): FarmProgress | null {
  let done = 0;
  let total = 0;
  for (const seasonId of seasonIds) {
    const recs = timelines.get(seasonId) ?? [];
    total += recs.length;
    done += recs.filter((rec) => isApplied(rec.status)).length;
  }
  if (total === 0) return null;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function ProducerFarmsSection({
  producerId,
  farms,
  loadingFarms,
  showSeasonActions,
  onNewFarm,
}: {
  producerId: string;
  farms: ProducerFarm[];
  loadingFarms: boolean;
  showSeasonActions: boolean;
  onNewFarm: () => void;
}) {
  const router = useRouter();
  const canCreateFarm = useCan("FARM_CREATE");
  const [search, setSearch] = useState("");

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

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return farms;
    return farms.filter((farm) =>
      `${farm.name} ${farm.location ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [farms, search]);

  return (
    <section>
      <SectionToolbar
        title="Fazendas"
        search={
          farms.length > 0
            ? { value: search, onChange: setSearch, placeholder: "Buscar fazenda…" }
            : undefined
        }
        actions={
          canCreateFarm ? (
            <Button className="hidden gap-2 sm:inline-flex" onClick={onNewFarm}>
              <Plus className="size-4" />
              Nova fazenda
            </Button>
          ) : undefined
        }
      />

      {loadingFarms ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl border border-border" />
          <Skeleton className="h-20 w-full rounded-xl border border-border" />
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
            {canCreateFarm ? (
              <Button size="sm" className="mt-2 gap-1.5" onClick={onNewFarm}>
                <Plus className="size-4" />
                Cadastrar primeira fazenda
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : filteredFarms.length === 0 ? (
        <EmptyState
          variant="inline"
          title="Nenhuma fazenda encontrada."
          description={`Não há fazendas com o nome "${search.trim()}".`}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredFarms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              showSeasonActions={showSeasonActions}
              activeCyclesCount={activeCyclesByFarm.get(farm.id) ?? 0}
              progress={farmProgressFromTimelines(
                farm.seasons
                  .filter((season) => RUNNING_SEASON_STATUSES.has(season.status))
                  .map((season) => season.id),
                timelinesBySeason,
              )}
              onOpen={() =>
                router.push(
                  routes.fazendas.detalhe(farm.id, { producer_id: producerId }),
                )
              }
            />
          ))}
        </div>
      )}

      {canCreateFarm ? (
        <StickyMobileCta>
          <Button size="lg" className="gap-2" onClick={onNewFarm}>
            <Plus className="size-4" />
            Nova fazenda
          </Button>
        </StickyMobileCta>
      ) : null}
    </section>
  );
}

/** Linha de fazenda do design: ícone, nome + badge de safras, meta e progresso
 *  inline à direita (desktop) ou abaixo (mobile). A linha toda navega. */
function FarmCard({
  farm,
  showSeasonActions,
  activeCyclesCount,
  progress,
  onOpen,
}: {
  farm: ProducerFarm;
  showSeasonActions: boolean;
  activeCyclesCount: number;
  progress: FarmProgress | null;
  onOpen: () => void;
}) {
  const totalHectares = farm.plots.reduce(
    (acc, plot) => acc + (parseFloat(plot.area_hectares) || 0),
    0,
  );

  const metaParts = [
    farm.location?.trim(),
    `${farm.plots.length} ${farm.plots.length === 1 ? "talhão" : "talhões"}`,
    `${fmtHa(totalHectares)} ha`,
  ].filter(Boolean);

  const showProgress = showSeasonActions && progress != null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <button
        type="button"
        className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-hover/30"
        onClick={onOpen}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
          <Tractor className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-text-strong">
              {farm.name}
            </span>
            {activeCyclesCount > 0 ? (
              <Badge variant="neutral" className="shrink-0">
                {activeCyclesCount}{" "}
                {activeCyclesCount === 1 ? "safra" : "safras"}
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            {farm.location ? (
              <MapPin className="size-3.5 shrink-0 text-primary-strong/70" />
            ) : null}
            <span className="truncate">{metaParts.join(" · ")}</span>
          </span>
        </span>
        {showProgress ? (
          <span className="hidden w-56 shrink-0 lg:block">
            <span className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {progress.done}/{progress.total} aplicadas
              </span>
              <span className="font-semibold tabular-nums text-primary-strong">
                {progress.pct}%
              </span>
            </span>
            <ProgressBar value={progress.pct} className="h-1.5 bg-surface-2" />
          </span>
        ) : null}
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>

      {showProgress ? (
        <div className="border-t border-border bg-rail px-4 py-3 lg:hidden">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {progress.done}/{progress.total} aplicadas
            </span>
            <span className="font-semibold tabular-nums text-primary-strong">
              {progress.pct}%
            </span>
          </div>
          <ProgressBar value={progress.pct} className="h-1.5" />
        </div>
      ) : null}
    </div>
  );
}
