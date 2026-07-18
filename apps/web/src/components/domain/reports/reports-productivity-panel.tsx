"use client";

import { cn } from "@recomenda/utils";

type ProductivityRow = {
  id: string;
  label: string;
  bagsPerHa: number;
};

export function ReportsProductivityPanel({
  rows,
  breakEven,
  chartMax,
}: {
  rows: ProductivityRow[];
  breakEven: number;
  chartMax: number;
}) {
  const breakEvenPct = chartMax > 0 ? (breakEven / chartMax) * 100 : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4.5">
        <h3 className="font-display text-base font-semibold text-text-strong">
          Produtividade por safra (sc/ha)
        </h3>
        {breakEven > 0 ? (
          <span className="text-[12.5px] text-muted-foreground">
            ponto de equilíbrio · {Math.round(breakEven)} sc/ha
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Nenhuma safra colhida com produtividade registrada.
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5">
          {rows.map((row) => {
            const belowBreakEven = breakEven > 0 && row.bagsPerHa < breakEven;
            const barWidth = chartMax > 0 ? (row.bagsPerHa / chartMax) * 100 : 0;

            return (
              <div key={row.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-[13.5px] font-medium text-text">
                    {row.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      belowBreakEven ? "text-warning-strong" : "text-text-strong",
                    )}
                  >
                    {row.bagsPerHa.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    sc/ha
                  </span>
                </div>
                <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      belowBreakEven ? "bg-warning" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, barWidth)}%` }}
                  />
                  {breakEven > 0 ? (
                    <div
                      className="absolute inset-y-[-3px] w-0.5 bg-clay"
                      style={{ left: `${Math.min(100, breakEvenPct)}%` }}
                      aria-hidden
                    />
                  ) : null}
                </div>
              </div>
            );
          })}

          {breakEven > 0 ? (
            <p className="mt-1 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3.5 bg-clay" aria-hidden />
              A linha terracota marca o ponto de equilíbrio ({Math.round(breakEven)} sc/ha).
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
