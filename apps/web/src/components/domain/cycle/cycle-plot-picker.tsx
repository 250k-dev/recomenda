"use client";

import { Check, MapPinned } from "lucide-react";

import type { CyclePlotInput, PlotCycleUsage } from "@recomenda/api/cycles";
import { cn } from "@recomenda/utils";
import { Badge } from "@recomenda/ui/primitives/badge";
import { MoneyInput } from "@recomenda/ui/forms/money-input";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export type PickerFarm = {
  id: string;
  name: string;
  plots: Array<{ id: string; name: string; area_hectares: string | number }>;
};

/** Talhão marcado → área na safra (valor canônico; "" = área cadastral). */
export type PlotSelection = Map<string, string>;

/** Uso do talhão por outras safras ativas (área usada e livre). */
export type PlotUsageMap = Map<string, PlotCycleUsage>;

/** Monta o mapa de uso, opcionalmente sem a própria safra (tela da safra). */
export function plotUsageMap(
  rows: PlotCycleUsage[] | undefined,
  excludeCycleId?: string,
): PlotUsageMap {
  const map: PlotUsageMap = new Map();
  for (const row of rows ?? []) {
    const cycles = row.cycles.filter((c) => c.id !== excludeCycleId);
    if (cycles.length === 0) continue;
    const used = cycles.reduce((sum, c) => sum + c.area_ha, 0);
    map.set(row.plot_id, {
      ...row,
      cycles,
      used_ha: used,
      free_ha: Math.max(0, row.plot_area_ha - used),
    });
  }
  return map;
}

/**
 * Seleção inicial: os talhões livres inteiros; o que outra safra usa só em
 * parte (500 de 1.000 ha) entra com a área que sobrou; o que está ocupado por
 * inteiro fica desmarcado — assim a 2ª safra (ex.: feijão) nasce com o que
 * sobrou para ela.
 */
export function defaultPlotSelection(
  farms: PickerFarm[],
  usage: PlotUsageMap,
): PlotSelection {
  const selection: PlotSelection = new Map();
  for (const farm of farms) {
    for (const plot of farm.plots) {
      const use = usage.get(plot.id);
      if (!use) selection.set(plot.id, "");
      else if (use.free_ha > 0.0001) selection.set(plot.id, String(use.free_ha));
    }
  }
  return selection;
}

/** Seleção → payload da API. Área vazia ou igual à cadastral vai como null. */
export function plotSelectionToInput(
  selection: PlotSelection,
  farms: PickerFarm[],
): CyclePlotInput[] {
  const cadastral = new Map(
    farms.flatMap((f) => f.plots.map((p) => [p.id, Number(p.area_hectares) || 0] as const)),
  );
  return [...selection.entries()].map(([plotId, area]) => {
    const value = area ? Number(area) : NaN;
    const valid = Number.isFinite(value) && value > 0 && value !== cadastral.get(plotId);
    return { plot_id: plotId, area_ha: valid ? value : null };
  });
}

/** Área total da seleção (área na safra, senão a cadastral). */
export function plotSelectionArea(selection: PlotSelection, farms: PickerFarm[]): number {
  let total = 0;
  for (const farm of farms) {
    for (const plot of farm.plots) {
      if (!selection.has(plot.id)) continue;
      const area = Number(selection.get(plot.id));
      total += Number.isFinite(area) && area > 0 ? area : Number(plot.area_hectares) || 0;
    }
  }
  return total;
}

/**
 * Escolha dos talhões da safra, agrupados por fazenda: marcar o talhão e,
 * se a safra usar só parte dele, informar a área (ex.: 40 dos 100 ha). Talhão
 * que já está em outra safra ativa mostra o aviso.
 */
export function CyclePlotPicker({
  farms,
  selection,
  onChange,
  usage,
  maxHeightClass = "max-h-72",
}: {
  farms: PickerFarm[];
  selection: PlotSelection;
  onChange: (next: PlotSelection) => void;
  /** Talhão → safras ativas em que ele já está (e quanto usam). */
  usage?: PlotUsageMap;
  maxHeightClass?: string;
}) {
  const toggle = (plotId: string) => {
    const next = new Map(selection);
    if (next.has(plotId)) next.delete(plotId);
    else next.set(plotId, "");
    onChange(next);
  };
  const setArea = (plotId: string, area: string) => {
    const next = new Map(selection);
    next.set(plotId, area);
    onChange(next);
  };
  const toggleFarm = (farm: PickerFarm, checked: boolean) => {
    const next = new Map(selection);
    for (const plot of farm.plots) {
      if (checked) {
        if (!next.has(plot.id)) next.set(plot.id, "");
      } else {
        next.delete(plot.id);
      }
    }
    onChange(next);
  };

  const count = [...selection.keys()].filter((id) =>
    farms.some((f) => f.plots.some((p) => p.id === id)),
  ).length;
  const area = plotSelectionArea(selection, farms);

  return (
    <div className="space-y-2">
      <div className={cn("space-y-3 overflow-y-auto pr-1", maxHeightClass)}>
        {farms.map((farm) => {
          const allChecked =
            farm.plots.length > 0 && farm.plots.every((p) => selection.has(p.id));
          return (
            <div key={farm.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MapPinned className="size-3.5 shrink-0" />
                  <span className="truncate">{farm.name}</span>
                </p>
                {farm.plots.length > 1 ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-primary-strong hover:underline"
                    onClick={() => toggleFarm(farm, !allChecked)}
                  >
                    {allChecked ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                ) : null}
              </div>
              {farm.plots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                  Esta fazenda ainda não tem talhões cadastrados. Cadastre os
                  talhões na ficha da fazenda para incluí-los na safra.
                </p>
              ) : (
                farm.plots.map((plot) => {
                  const checked = selection.has(plot.id);
                  const cadastral = Number(plot.area_hectares) || 0;
                  const use = usage?.get(plot.id);
                  return (
                    <div
                      key={plot.id}
                      className={cn(
                        "flex flex-wrap items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                        checked ? "border-primary/50 bg-primary-soft/20" : "border-border",
                      )}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md transition-colors",
                            checked
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-surface text-transparent",
                          )}
                        >
                          {checked ? <Check className="size-3.5" /> : null}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(plot.id)}
                          className="sr-only"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{plot.name}</span>
                          {use ? (
                            <Badge variant="warning" className="mt-0.5 px-1.5 py-0 text-[10px]">
                              {use.free_ha > 0.0001
                                ? `${use.cycles.map((c) => `${c.name} usa ${fmtHa(c.area_ha)} ha`).join(", ")} · livre ${fmtHa(use.free_ha)} ha`
                                : `já está na ${use.cycles.map((c) => c.name).join(", ")}`}
                            </Badge>
                          ) : null}
                        </span>
                      </label>
                      {checked ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <MoneyInput
                            aria-label={`Área de ${plot.name} na safra (ha)`}
                            className="h-8 w-24 text-right tabular-nums"
                            value={selection.get(plot.id) ?? ""}
                            placeholder={fmtHa(cadastral)}
                            onValueChange={(v) => setArea(plot.id, v)}
                          />
                          <span>de {fmtHa(cadastral)} ha</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {fmtHa(cadastral)} ha
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {count} {count === 1 ? "talhão" : "talhões"} · {fmtHa(area)} ha na safra.
        Deixe a área em branco para usar o talhão inteiro.
      </p>
    </div>
  );
}
