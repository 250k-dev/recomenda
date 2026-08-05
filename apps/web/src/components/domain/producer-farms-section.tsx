"use client";

import { routes } from "@recomenda/config";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, MapPin, Plus, Tractor, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { Input } from "@recomenda/ui/primitives/input";
import { Search } from "lucide-react";
import { queryKeys, useCan, useDeleteFarm, usePrincipal } from "@recomenda/api-hooks";
import { getTimeline, type Recommendation } from "@recomenda/api/seasons";
import { getFarmCycles, type CycleSummary } from "@recomenda/api/cycles";
import type { ProducerFarm } from "@recomenda/api";
import { cn, formatCreatedBy } from "@recomenda/utils";
import { extractError } from "@/components/domain/season/_shared";
import { IncludeFarmInCycleDialog } from "@/components/domain/include-farm-in-cycle-dialog";

const RUNNING_SEASON_STATUSES = new Set(["PUBLISHED", "IN_PROGRESS"]);

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function isApplied(status: string): boolean {
  return status === "APPLIED_ON_TIME" || status === "APPLIED_LATE";
}

type FarmProgress = { done: number; total: number; pct: number };
type FarmCycleFilter = "all" | "with_cycle" | "without_cycle";

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
  /** Slot à esquerda da barra (ex.: toggle Fazendas/Safras) — alinha com a busca. */
  toolbarLeading,
}: {
  producerId: string;
  farms: ProducerFarm[];
  loadingFarms: boolean;
  showSeasonActions: boolean;
  onNewFarm: () => void;
  toolbarLeading?: ReactNode;
}) {
  const router = useRouter();
  const canCreateFarm = useCan("FARM_CREATE");
  const canDeletePerm = useCan("FARM_DELETE");
  const canCycleCrud = useCan("CYCLE_CRUD");
  const { role, id: meId } = usePrincipal();
  const deleteFarm = useDeleteFarm(producerId);
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<FarmCycleFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<ProducerFarm | null>(null);
  const [includeFarmId, setIncludeFarmId] = useState<string | null>(null);

  const canDeleteFarm = (farm: ProducerFarm) =>
    canDeletePerm &&
    (role !== "STAFF" ||
      (farm.created_by_user_id != null && farm.created_by_user_id === meId));

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

  const cycleQueries = useQueries({
    queries: farms.map((farm) => ({
      queryKey: queryKeys.farmCycles(farm.id),
      queryFn: () => getFarmCycles(farm.id),
      staleTime: 60_000,
    })),
  });

  const activeCyclesByFarm = useMemo(() => {
    const map = new Map<string, CycleSummary[]>();
    farms.forEach((farm, index) => {
      const cycles = (cycleQueries[index]?.data ?? []).filter(
        (c) => c.status === "ACTIVE",
      );
      map.set(farm.id, cycles);
    });
    return map;
  }, [farms, cycleQueries]);

  const cyclesCountByFarm = useMemo(() => {
    const map = new Map<string, number>();
    farms.forEach((farm, index) => {
      map.set(farm.id, cycleQueries[index]?.data?.length ?? 0);
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

  const withCycleCount = useMemo(
    () =>
      farms.filter((f) => (activeCyclesByFarm.get(f.id)?.length ?? 0) > 0)
        .length,
    [farms, activeCyclesByFarm],
  );
  const withoutCycleCount = farms.length - withCycleCount;

  const filteredFarms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return farms.filter((farm) => {
      const active = activeCyclesByFarm.get(farm.id)?.length ?? 0;
      if (cycleFilter === "with_cycle" && active === 0) return false;
      if (cycleFilter === "without_cycle" && active > 0) return false;
      if (!query) return true;
      return `${farm.name} ${farm.location ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
    });
  }, [farms, search, cycleFilter, activeCyclesByFarm]);

  const filterPills: Array<{
    value: FarmCycleFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "Todas", count: farms.length },
    { value: "with_cycle", label: "Com safra", count: withCycleCount },
    { value: "without_cycle", label: "Sem safra", count: withoutCycleCount },
  ];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {toolbarLeading ?? (
          <h2 className="min-w-0 font-display text-lg font-semibold text-text-strong">
            Fazendas
          </h2>
        )}
        <div className="hidden min-w-4 flex-1 sm:block" />
        {farms.length > 0 ? (
          <div className="relative w-full sm:w-60 lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fazenda…"
              aria-label="Buscar fazenda"
              className="h-10 pl-9"
            />
          </div>
        ) : null}
        {canCreateFarm ? (
          <Button
            className="hidden h-10 gap-2 sm:inline-flex"
            onClick={onNewFarm}
          >
            <Plus className="size-4" />
            Nova fazenda
          </Button>
        ) : null}
      </div>

      {farms.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {filterPills.map((pill) => {
            const active = cycleFilter === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setCycleFilter(pill.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/25 bg-primary-soft/40 text-primary-strong hover:bg-primary-soft",
                )}
              >
                {pill.label}
                <span className="tabular-nums opacity-80">{pill.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

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
                Cadastre a primeira fazenda para iniciar o acompanhamento das
                safras.
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
          description={
            search.trim()
              ? `Não há fazendas com o nome "${search.trim()}".`
              : "Nenhuma fazenda neste filtro."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredFarms.map((farm) => (
            <FarmCard
              key={farm.id}
              farm={farm}
              showSeasonActions={showSeasonActions}
              activeCycles={activeCyclesByFarm.get(farm.id) ?? []}
              progress={farmProgressFromTimelines(
                farm.seasons
                  .filter((season) => RUNNING_SEASON_STATUSES.has(season.status))
                  .map((season) => season.id),
                timelinesBySeason,
              )}
              canDelete={canDeleteFarm(farm)}
              canIncludeInCycle={canCycleCrud && showSeasonActions}
              onDelete={() => setPendingDelete(farm)}
              onIncludeInCycle={() => setIncludeFarmId(farm.id)}
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

      {includeFarmId ? (
        <IncludeFarmInCycleDialog
          open
          onOpenChange={(open) => {
            if (!open) setIncludeFarmId(null);
          }}
          farmId={includeFarmId}
          farmName={
            farms.find((f) => f.id === includeFarmId)?.name ?? "Fazenda"
          }
          producerId={producerId}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete
            ? `Excluir a fazenda "${pendingDelete.name}" permanentemente?`
            : "Excluir fazenda?"
        }
        description={
          pendingDelete ? (
            <FarmDeleteDescription
              plotCount={pendingDelete.plots.length}
              seasonCount={pendingDelete.seasons.length}
              cycleCount={cyclesCountByFarm.get(pendingDelete.id) ?? 0}
            />
          ) : undefined
        }
        confirmLabel="Excluir definitivamente"
        tone="destructive"
        loading={deleteFarm.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteFarm.mutateAsync(pendingDelete.id);
            toast.success("Fazenda excluída.");
            setPendingDelete(null);
          } catch (e) {
            toast.error(
              extractError(e) || "Não foi possível excluir a fazenda.",
            );
          }
        }}
      />
    </section>
  );
}

function FarmDeleteDescription({
  plotCount,
  seasonCount,
  cycleCount,
}: {
  plotCount: number;
  seasonCount: number;
  cycleCount: number;
}) {
  const hasLinkedData = plotCount > 0 || seasonCount > 0 || cycleCount > 0;
  if (!hasLinkedData) {
    return (
      <>
        A fazenda será removida da carteira. Esta ação não pode ser desfeita.
      </>
    );
  }

  const parts: string[] = [];
  if (plotCount > 0) {
    parts.push(`${plotCount} ${plotCount === 1 ? "talhão" : "talhões"}`);
  }
  if (cycleCount > 0) {
    parts.push(`${cycleCount} ${cycleCount === 1 ? "safra" : "safras"}`);
  }
  if (seasonCount > 0) {
    parts.push(
      `${seasonCount} ${
        seasonCount === 1 ? "programação de talhão" : "programações de talhão"
      }`,
    );
  }

  return (
    <>
      Esta ação apaga a fazenda e todos os dados vinculados ({parts.join(", ")},
      recomendações e listas de compra). Não pode ser desfeita.
    </>
  );
}

function FarmCard({
  farm,
  showSeasonActions,
  activeCycles,
  progress,
  canDelete,
  canIncludeInCycle,
  onDelete,
  onIncludeInCycle,
  onOpen,
}: {
  farm: ProducerFarm;
  showSeasonActions: boolean;
  activeCycles: CycleSummary[];
  progress: FarmProgress | null;
  canDelete: boolean;
  canIncludeInCycle: boolean;
  onDelete: () => void;
  onIncludeInCycle: () => void;
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

  const createdByLabel = formatCreatedBy(farm.created_by_name);
  const hasCycle = activeCycles.length > 0;
  const showProgress = showSeasonActions && progress != null && hasCycle;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex w-full items-center gap-2 px-2 py-2 sm:gap-3.5 sm:px-4 sm:py-4">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover/30"
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
              {!hasCycle ? (
                <Badge variant="neutral" className="shrink-0">
                  Sem safra
                </Badge>
              ) : (
                activeCycles.slice(0, 3).map((cycle) => (
                  <Badge
                    key={cycle.id}
                    variant="primary"
                    className="max-w-[10rem] shrink-0 truncate"
                  >
                    {cycle.name}
                  </Badge>
                ))
              )}
              {activeCycles.length > 3 ? (
                <Badge variant="neutral" className="shrink-0">
                  +{activeCycles.length - 3}
                </Badge>
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              {farm.location ? (
                <MapPin className="size-3.5 shrink-0 text-primary-strong/70" />
              ) : null}
              <span className="truncate">{metaParts.join(" · ")}</span>
            </span>
            {createdByLabel ? (
              <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground/90">
                {createdByLabel}
              </span>
            ) : null}
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
          {hasCycle || !canIncludeInCycle ? (
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          ) : null}
        </button>

        {!hasCycle && canIncludeInCycle ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hidden shrink-0 sm:inline-flex"
            onClick={onIncludeInCycle}
          >
            Incluir em safra
          </Button>
        ) : null}

        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Excluir fazenda ${farm.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      {!hasCycle && canIncludeInCycle ? (
        <div className="border-t border-border bg-rail px-4 py-3 sm:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onIncludeInCycle}
          >
            Incluir em safra
          </Button>
        </div>
      ) : null}

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
