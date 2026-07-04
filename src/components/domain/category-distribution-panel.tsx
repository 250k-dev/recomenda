"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";
import type { CategoryBreakdown } from "@/lib/cost-plan/calculate";

const brlSmall = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/**
 * Distribuição de gastos por categoria (barras horizontais com % e valor por segmento).
 * Reutilizado no plano de custo e no topo da lista de compra. Aceita o
 * `category_breakdown` do resumo (custo por categoria + share + sacas/ha).
 */
export function CategoryDistributionPanel({
  breakdown,
  defaultMode = "brl",
}: {
  breakdown: CategoryBreakdown[];
  defaultMode?: "brl" | "sacks";
}) {
  const [mode, setMode] = useState<"brl" | "sacks">(defaultMode);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Gastos por categoria</h3>
        <div className="flex rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("brl")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "brl" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
          >
            R$
          </button>
          <button
            type="button"
            onClick={() => setMode("sacks")}
            className={cn(
              "rounded px-2 py-0.5",
              mode === "sacks" ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
            )}
          >
            sacas/ha
          </button>
        </div>
      </div>
      {breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Informe preços para ver os gastos por categoria.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {breakdown.map((it) => {
            const color = CATEGORY_COLORS[it.category] ?? CATEGORY_COLORS.OTHER;
            return (
              <li key={it.category}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">
                    {CATEGORY_LABELS[it.category] ?? it.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {num(it.share_pct, 1)}% ·{" "}
                    {mode === "brl"
                      ? brlSmall(it.total_brl)
                      : `${num(it.sacks_per_ha, 2)} sc/ha`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, it.share_pct)}%`,
                      background: color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
