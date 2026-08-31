"use client";

import { useMemo, type ReactNode } from "react";

/**
 * Seleção de talhões agrupada por fazenda — o padrão usado tanto para aplicar
 * modelo em massa quanto para exportar a safra. Com duas fazendas de 20 talhões,
 * uma lista plana não diz de quem é cada talhão nem deixa marcar a fazenda
 * inteira; aqui cada fazenda vira um grupo com checkbox tri-state.
 */
export interface SelectablePlot {
  /** Id da seleção (season_id no aplicar, item.id no exportar). */
  id: string;
  farmId: string;
  farmName: string;
  label: string;
  /** Linha secundária (área, variedade, nº de etapas). */
  hint?: string | null;
  /** Bloqueado com motivo — ex.: cultura diferente da do modelo. */
  disabledReason?: string | null;
}

export interface FarmGroup {
  farmId: string;
  farmName: string;
  plots: SelectablePlot[];
}

export function groupPlotsByFarm(plots: SelectablePlot[]): FarmGroup[] {
  const map = new Map<string, FarmGroup>();
  for (const plot of plots) {
    const group = map.get(plot.farmId);
    if (group) group.plots.push(plot);
    else
      map.set(plot.farmId, {
        farmId: plot.farmId,
        farmName: plot.farmName,
        plots: [plot],
      });
  }
  return [...map.values()].sort((a, b) =>
    a.farmName.localeCompare(b.farmName, "pt-BR"),
  );
}

/** Checkbox que também assume o estado "parcial" (alguns marcados). */
function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      checked={checked}
      disabled={disabled}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function FarmPlotSelection({
  plots,
  selected,
  onChange,
  renderPlotExtra,
}: {
  plots: SelectablePlot[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Conteúdo extra dentro da linha do talhão (ex.: etapas no exportar). */
  renderPlotExtra?: (plot: SelectablePlot) => ReactNode;
}) {
  const groups = useMemo(() => groupPlotsByFarm(plots), [plots]);
  const selectable = plots.filter((p) => !p.disabledReason);
  const allSelected =
    selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const someSelected = selectable.some((p) => selected.has(p.id));

  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };

  const totalLabel = `${selected.size} de ${selectable.length} ${
    selectable.length === 1 ? "talhão" : "talhões"
  }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
        <label className="flex cursor-pointer items-center gap-2.5">
          <TriStateCheckbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={(on) =>
              setMany(
                selectable.map((p) => p.id),
                on,
              )
            }
          />
          <span className="text-sm font-semibold text-text-strong">
            Selecionar todos
          </span>
        </label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {totalLabel}
        </span>
      </div>

      {groups.map((group) => {
        const groupSelectable = group.plots.filter((p) => !p.disabledReason);
        const groupAll =
          groupSelectable.length > 0 &&
          groupSelectable.every((p) => selected.has(p.id));
        const groupSome = groupSelectable.some((p) => selected.has(p.id));
        const groupCount = groupSelectable.filter((p) =>
          selected.has(p.id),
        ).length;

        return (
          <section
            key={group.farmId}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                <TriStateCheckbox
                  checked={groupAll}
                  indeterminate={groupSome && !groupAll}
                  disabled={groupSelectable.length === 0}
                  onChange={(on) =>
                    setMany(
                      groupSelectable.map((p) => p.id),
                      on,
                    )
                  }
                />
                <span className="truncate text-sm font-semibold text-text-strong">
                  {group.farmName}
                </span>
              </label>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {groupCount}/{group.plots.length}
              </span>
            </div>

            <ul className="flex flex-col">
              {group.plots.map((plot) => {
                const blocked = Boolean(plot.disabledReason);
                return (
                  <li
                    key={plot.id}
                    className="border-b border-border/60 px-3 py-2 last:border-b-0"
                  >
                    <label
                      className={
                        blocked
                          ? "flex items-start gap-2.5 opacity-60"
                          : "flex cursor-pointer items-start gap-2.5"
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={selected.has(plot.id)}
                        disabled={blocked}
                        onChange={(e) => setMany([plot.id], e.target.checked)}
                      />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium text-text-strong">
                          {plot.label}
                        </span>
                        {plot.disabledReason ? (
                          <span className="block text-xs text-warning-strong">
                            {plot.disabledReason}
                          </span>
                        ) : plot.hint ? (
                          <span className="block text-xs text-muted-foreground">
                            {plot.hint}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {renderPlotExtra?.(plot)}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
