"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPinned,
  Plus,
  SquareCheckBig,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import { Search } from "lucide-react";
import {
  useCan,
  useCycleAvailablePlots,
  useProducerFarms,
  useRemoveCycleFarm,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import type { CycleDetail, CycleSeasonRow } from "@recomenda/api/cycles";
import {
  cn,
  CROP_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  labelStatus,
} from "@recomenda/utils";
import { routes } from "@recomenda/config";
import { AddCycleFarmDialog } from "@/components/domain/cycle/cycle-farms-section";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function seasonDisplayName(season: CycleSeasonRow): string {
  const varietyNames = (season.varieties ?? [])
    .map((v) => v.variety)
    .filter(Boolean);
  const varietyLabel =
    varietyNames.length > 0 ? varietyNames.join(" + ") : (season.variety ?? "");
  return `${CROP_LABELS[season.crop] ?? season.crop}${
    varietyLabel ? ` — ${varietyLabel}` : ""
  }`;
}

function seasonRowData(
  season: CycleSeasonRow,
  farmId: string,
  producerId: string,
) {
  const recommendationHref = routes.safras.cronograma(season.id, {
    farm_id: farmId || season.farm_id || undefined,
    producer_id: producerId,
  });
  const pct =
    season.recommendations_total > 0
      ? Math.round(
          (season.recommendations_done / season.recommendations_total) * 100,
        )
      : 0;
  const seasonVarieties = season.varieties ?? [];
  const varietiesBreakdown =
    seasonVarieties.length > 1
      ? seasonVarieties
          .map(
            (v) =>
              `${v.variety}${
                v.planted_area_ha != null
                  ? ` (${fmtHa(v.planted_area_ha)} ha)`
                  : ""
              }`,
          )
          .join(" · ")
      : null;
  const partialArea =
    season.planted_area_ha != null &&
    season.planted_area_ha !== season.plot_area_ha;
  return {
    recommendationHref,
    pct,
    displayName: seasonDisplayName(season),
    varietiesBreakdown,
    partialArea,
    area: season.planted_area_ha ?? season.plot_area_ha,
  };
}

type FarmGroup = {
  farmId: string;
  farmName: string;
  location: string | null;
  cadastralHa: number;
  seasons: CycleSeasonRow[];
};

/**
 * Safra: disclosures por fazenda. Dentro de cada fazenda, mantém o padrão
 * atual do card/linha de talhão (progresso, status, Recomendações, remover).
 */
export function CycleFarmDisclosures({
  cycle,
  producerId,
  seasons,
  onAddPlot,
  onArchiveSeason,
  archivePending,
}: {
  cycle: CycleDetail;
  producerId: string;
  seasons: CycleSeasonRow[];
  onAddPlot: () => void;
  onArchiveSeason: (payload: { id: string; name: string }) => void;
  archivePending?: boolean;
}) {
  const canManage = useCan("CYCLE_CRUD");
  const { data: producerFarms } = useProducerFarms(producerId);
  const { data: availablePlots = [] } = useCycleAvailablePlots(cycle.id);
  const removeCycleFarm = useRemoveCycleFarm(cycle.id);

  const [plotFilter, setPlotFilter] = useState("");
  const [addFarmOpen, setAddFarmOpen] = useState(false);
  const [removeFarm, setRemoveFarm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [openFarms, setOpenFarms] = useState<Set<string>>(new Set());

  const locationByFarm = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const f of producerFarms ?? []) {
      map.set(f.id, f.location?.trim() || null);
    }
    return map;
  }, [producerFarms]);

  /** Fazendas que ainda têm talhão cadastral fora desta safra. */
  const farmsWithAvailablePlots = useMemo(() => {
    const set = new Set<string>();
    for (const plot of availablePlots) {
      set.add(plot.farm_id);
    }
    return set;
  }, [availablePlots]);

  const farmGroups = useMemo((): FarmGroup[] => {
    const query = plotFilter.trim().toLocaleLowerCase("pt-BR");
    const seasonsByFarm = new Map<string, CycleSeasonRow[]>();
    for (const season of seasons) {
      if (
        query &&
        !season.plot_name.toLocaleLowerCase("pt-BR").includes(query)
      ) {
        continue;
      }
      const id = season.farm_id ?? cycle.farm_id;
      const list = seasonsByFarm.get(id) ?? [];
      list.push(season);
      seasonsByFarm.set(id, list);
    }

    return (cycle.farms ?? []).map((farm) => ({
      farmId: farm.id,
      farmName: farm.name,
      location: locationByFarm.get(farm.id) ?? null,
      cadastralHa: farm.area_hectares_sum,
      seasons: seasonsByFarm.get(farm.id) ?? [],
    }));
  }, [cycle.farms, cycle.farm_id, seasons, plotFilter, locationByFarm]);

  const farmIdsKey = (cycle.farms ?? []).map((f) => f.id).join(",");
  // Abre todas as fazendas na primeira carga / quando a lista de fazendas muda.
  useEffect(() => {
    setOpenFarms(new Set(farmIdsKey ? farmIdsKey.split(",") : []));
  }, [cycle.id, farmIdsKey]);

  const toggleFarm = (farmId: string) => {
    setOpenFarms((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) next.delete(farmId);
      else next.add(farmId);
      return next;
    });
  };

  const canRemoveFarm = (cycle.farms?.length ?? 0) > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="min-w-0 font-display text-lg font-semibold text-text-strong">
          Fazendas desta safra
        </h2>
        <div className="hidden min-w-4 flex-1 sm:block" />
        {seasons.length > 0 ? (
          <div className="relative w-full sm:w-60 lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={plotFilter}
              onChange={(e) => setPlotFilter(e.target.value)}
              placeholder="Filtrar talhão…"
              aria-label="Filtrar talhão"
              className="h-10 pl-9"
            />
          </div>
        ) : null}
        {canManage && cycle.can_add_farms !== false ? (
          <Button
            className="hidden h-10 gap-1.5 sm:inline-flex"
            onClick={() => setAddFarmOpen(true)}
          >
            <Plus className="size-4" />
            Adicionar fazenda
          </Button>
        ) : null}
      </div>

      {farmGroups.length === 0 ? (
        <EmptyState
          title="Nenhuma fazenda nesta safra."
          description="Adicione pelo menos uma fazenda para programar talhões."
          action={
            canManage && cycle.can_add_farms !== false ? (
              <Button size="sm" onClick={() => setAddFarmOpen(true)}>
                Adicionar fazenda
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {farmGroups.map((group) => {
            const open = openFarms.has(group.farmId);
            const done = group.seasons.reduce(
              (s, row) => s + row.recommendations_done,
              0,
            );
            const total = group.seasons.reduce(
              (s, row) => s + row.recommendations_total,
              0,
            );
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            // Um talhão pode ter mais de uma season (culturas/replantio) —
            // hectares e contagem usam talhão físico único.
            const seasonRank = (status: string) =>
              status === "HARVESTED" || status === "harvested" ? 0 : 1;
            const repByPlot = new Map<string, CycleSeasonRow>();
            for (const s of group.seasons) {
              const cur = repByPlot.get(s.plot_id);
              if (!cur || seasonRank(s.status) > seasonRank(cur.status)) {
                repByPlot.set(s.plot_id, s);
              }
            }
            const areaHa = [...repByPlot.values()].reduce(
              (sum, s) => sum + (s.planted_area_ha ?? s.plot_area_ha),
              0,
            );
            const plotsCount = repByPlot.size;
            const cropBadge = group.seasons[0]
              ? seasonDisplayName(group.seasons[0])
              : null;
            const meta = [
              group.location,
              `${plotsCount} ${plotsCount === 1 ? "talhão" : "talhões"}`,
              `${fmtHa(areaHa > 0 ? areaHa : group.cadastralHa)} ha`,
            ]
              .filter(Boolean)
              .join(" · ");
            const canAddPlotToFarm = farmsWithAvailablePlots.has(group.farmId);

            return (
              <div
                key={group.farmId}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-4 sm:py-3.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-hover/30"
                    onClick={() => toggleFarm(group.farmId)}
                    aria-expanded={open}
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        !open && "-rotate-90",
                      )}
                    />
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                      <MapPinned className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-text-strong">
                          {group.farmName}
                        </span>
                        {cropBadge ? (
                          <Badge
                            variant="primary"
                            className="hidden max-w-[14rem] truncate sm:inline-flex"
                          >
                            {cropBadge}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {meta}
                      </span>
                    </span>
                    {total > 0 ? (
                      <span className="hidden w-44 shrink-0 lg:block">
                        <span className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="tabular-nums text-muted-foreground">
                            {done}/{total}
                          </span>
                          <span className="font-semibold tabular-nums text-primary-strong">
                            {pct}%
                          </span>
                        </span>
                        <ProgressBar
                          value={pct}
                          className="h-1.5 bg-surface-2"
                        />
                      </span>
                    ) : null}
                  </button>

                  {canAddPlotToFarm ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hidden shrink-0 gap-1 sm:inline-flex"
                      onClick={onAddPlot}
                    >
                      <Plus className="size-3.5" />
                      Talhão
                    </Button>
                  ) : null}

                  {canManage && canRemoveFarm ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-danger-strong"
                      title="Remover fazenda da safra"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoveFarm({
                          id: group.farmId,
                          name: group.farmName,
                        });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>

                {open ? (
                  <div className="border-t border-border">
                    {group.seasons.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          {plotFilter.trim()
                            ? "Nenhum talhão corresponde ao filtro nesta fazenda."
                            : canAddPlotToFarm
                              ? "Nenhum talhão programado nesta fazenda."
                              : "Nenhum talhão disponível para programar nesta fazenda."}
                        </p>
                        {!plotFilter.trim() && canAddPlotToFarm ? (
                          <Button
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={onAddPlot}
                          >
                            <Plus className="size-4" />
                            Adicionar talhão
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        {/* Desktop: padrão atual da linha de talhão */}
                        <div className="hidden md:block">
                          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 bg-surface-2 px-5 py-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                            <span>Talhão</span>
                            <span>Cultura / variedade</span>
                            <span>Área</span>
                            <span>Progresso</span>
                            <span>Status</span>
                            <span className="text-right">Ações</span>
                          </div>
                          {group.seasons.map((season) => {
                            const row = seasonRowData(
                              season,
                              group.farmId,
                              producerId,
                            );
                            return (
                              <div
                                key={season.id}
                                className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 border-t border-border px-5 py-3.5 text-sm"
                              >
                                <span className="truncate font-semibold text-text-strong">
                                  Talhão {season.plot_name}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-muted-foreground">
                                    {row.displayName}
                                  </span>
                                  {row.varietiesBreakdown ? (
                                    <span className="block truncate text-xs text-muted-foreground/80">
                                      {row.varietiesBreakdown}
                                    </span>
                                  ) : null}
                                </span>
                                <span className="tabular-nums">
                                  {fmtHa(row.area)} ha
                                  {row.partialArea ? (
                                    <span className="block text-xs text-muted-foreground">
                                      de {fmtHa(season.plot_area_ha)} ha
                                    </span>
                                  ) : null}
                                </span>
                                <span>
                                  {season.recommendations_total > 0 ? (
                                    <span className="flex items-center gap-2">
                                      <ProgressBar
                                        value={row.pct}
                                        className="h-1.5 flex-1 bg-surface-2"
                                      />
                                      <span className="shrink-0 text-xs font-semibold tabular-nums text-primary-strong">
                                        {row.pct}%
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </span>
                                <span>
                                  <Badge
                                    variant={
                                      STATUS_VARIANTS[season.status] ??
                                      "default"
                                    }
                                  >
                                    {labelStatus(STATUS_LABELS, season.status)}
                                  </Badge>
                                </span>
                                <span className="flex justify-end gap-4">
                                  <Button asChild variant="secondary" size="sm">
                                    <Link href={row.recommendationHref}>
                                      Recomendações
                                      <ChevronRight />
                                    </Link>
                                  </Button>
                                  {season.status !== "ARCHIVED" ? (
                                    <Button
                                      variant="destructive"
                                      size="icon-sm"
                                      disabled={archivePending}
                                      onClick={() =>
                                        onArchiveSeason({
                                          id: season.id,
                                          name: `${season.plot_name} — ${row.displayName}`,
                                        })
                                      }
                                    >
                                      <Trash2 />
                                    </Button>
                                  ) : null}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Mobile: card de talhão atual */}
                        <div className="flex flex-col gap-2.5 p-3 md:hidden">
                          {group.seasons.map((season) => {
                            const row = seasonRowData(
                              season,
                              group.farmId,
                              producerId,
                            );
                            return (
                              <div
                                key={season.id}
                                className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-text-strong">
                                      Talhão {season.plot_name}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                      {row.displayName} · {fmtHa(row.area)}
                                      {row.partialArea
                                        ? ` de ${fmtHa(season.plot_area_ha)}`
                                        : ""}{" "}
                                      ha
                                    </p>
                                  </div>
                                  <Badge
                                    className="shrink-0"
                                    variant={
                                      STATUS_VARIANTS[season.status] ??
                                      "default"
                                    }
                                  >
                                    {labelStatus(STATUS_LABELS, season.status)}
                                  </Badge>
                                </div>
                                {season.recommendations_total > 0 ? (
                                  <div className="mt-3">
                                    <div className="mb-1.5 flex items-center justify-between text-xs">
                                      <span className="text-muted-foreground">
                                        {season.recommendations_done}/
                                        {season.recommendations_total}{" "}
                                        aplicadas
                                      </span>
                                      <span className="font-semibold tabular-nums text-primary-strong">
                                        {row.pct}%
                                      </span>
                                    </div>
                                    <ProgressBar
                                      value={row.pct}
                                      className="h-1.5"
                                    />
                                  </div>
                                ) : null}
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    asChild
                                    variant="secondary"
                                    size="sm"
                                    className="flex-1"
                                  >
                                    <Link href={row.recommendationHref}>
                                      <SquareCheckBig />
                                      Recomendações
                                    </Link>
                                  </Button>
                                  {season.status !== "ARCHIVED" ? (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="shrink-0"
                                      disabled={archivePending}
                                      onClick={() =>
                                        onArchiveSeason({
                                          id: season.id,
                                          name: `${season.plot_name} — ${row.displayName}`,
                                        })
                                      }
                                    >
                                      <Trash2 />
                                      Remover
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <AddCycleFarmDialog
        open={addFarmOpen}
        onOpenChange={setAddFarmOpen}
        cycleId={cycle.id}
        producerId={producerId}
        cycleFarms={cycle.farms ?? []}
      />

      <ConfirmDialog
        open={!!removeFarm}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveFarm(null);
            setRemoveError(null);
          }
        }}
        title="Remover fazenda da safra"
        description={
          <>
            {removeFarm
              ? `"${removeFarm.name}" será desvinculada desta safra. Talhões com programação publicada, em andamento ou colhida impedem a remoção.`
              : null}
            {removeError ? (
              <span className="mt-2 block font-medium text-danger-strong">
                {removeError}
              </span>
            ) : null}
          </>
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={removeCycleFarm.isPending}
        onConfirm={async () => {
          if (!removeFarm) return;
          setRemoveError(null);
          await new Promise<void>((resolve) =>
            removeCycleFarm.mutate(removeFarm.id, {
              onSuccess: () => {
                toast.success("Fazenda removida da safra.");
                setRemoveFarm(null);
                resolve();
              },
              onError: (err) => {
                setRemoveError(
                  apiErrorMessage(
                    err,
                    "Não foi possível remover a fazenda desta safra.",
                  ),
                );
                resolve();
              },
            }),
          );
        }}
      />
    </div>
  );
}
