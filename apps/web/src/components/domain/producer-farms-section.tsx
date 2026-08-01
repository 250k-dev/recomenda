"use client";

import { routes } from "@recomenda/config";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, MapPin, Plus, Tractor, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { Skeleton } from "@recomenda/ui/primitives/skeleton";
import { queryKeys, useCan, useDeleteFarm, usePrincipal } from "@recomenda/api-hooks";
import { getTimeline, type Recommendation } from "@recomenda/api/seasons";
import { getFarmCycles } from "@recomenda/api/cycles";
import type { ProducerFarm } from "@recomenda/api";
import { formatCreatedBy } from "@recomenda/utils";
import { extractError } from "@/components/domain/season/_shared";

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
  const canDeletePerm = useCan("FARM_DELETE");
  const { role, id: meId } = usePrincipal();
  const deleteFarm = useDeleteFarm(producerId);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProducerFarm | null>(null);

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
              canDelete={canDeleteFarm(farm)}
              onDelete={() => setPendingDelete(farm)}
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
            toast.error(extractError(e) || "Não foi possível excluir a fazenda.");
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
      `${seasonCount} ${seasonCount === 1 ? "programação de talhão" : "programações de talhão"}`,
    );
  }

  return (
    <>
      Esta ação apaga a fazenda e todos os dados vinculados ({parts.join(", ")},
      recomendações e listas de compra). Não pode ser desfeita.
    </>
  );
}

/** Linha de fazenda do design: ícone, nome + badge de safras, meta e progresso
 *  inline à direita (desktop) ou abaixo (mobile). A linha toda navega. */
function FarmCard({
  farm,
  showSeasonActions,
  activeCyclesCount,
  progress,
  canDelete,
  onDelete,
  onOpen,
}: {
  farm: ProducerFarm;
  showSeasonActions: boolean;
  activeCyclesCount: number;
  progress: FarmProgress | null;
  canDelete: boolean;
  onDelete: () => void;
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

  const showProgress = showSeasonActions && progress != null;

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
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>

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
