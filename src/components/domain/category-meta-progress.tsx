"use client";

import { useMemo } from "react";
import { AlertTriangle, Target } from "lucide-react";
import { useCurrencyStore, DEFAULT_GRAIN_PRICE_BRL } from "@/stores/currency";
import { computePurchaseListMetrics } from "@/lib/purchase-list-breakdown";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";
import type { ListItem } from "@/components/domain/season/_shared";
import { cn } from "@/lib/utils";

const num = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Progresso das metas por categoria (Real × Meta em sc/ha) com aviso ao estourar.
 * Só aparece quando o agrônomo definiu ao menos uma meta — sem metas, a lista de
 * compra fica normal (o componente não renderiza nada).
 */
export function CategoryMetaProgress({
  items,
  totalHa,
  targets,
  className,
}: {
  items: ListItem[];
  totalHa: number;
  targets: Record<string, number>;
  className?: string;
}) {
  const fxRate = useCurrencyStore((s) => s.fxRate);
  const grainPrice = useCurrencyStore((s) => s.grainPrice);
  const fx = Number(fxRate) || 0;
  const saca = Number(grainPrice) || DEFAULT_GRAIN_PRICE_BRL;
  const metrics = useMemo(
    () => computePurchaseListMetrics(items, totalHa, fx, saca),
    [items, totalHa, fx, saca],
  );

  const rows = metrics.categoryBreakdown
    .map((r) => ({ ...r, target: targets[r.category] ?? 0 }))
    .filter((r) => r.target > 0);

  if (rows.length === 0) return null;

  const over = rows.filter((r) => r.sacks_per_ha > r.target);

  return (
    <section className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Target className="h-4 w-4 text-primary-strong" />
        <h3 className="text-sm font-semibold text-foreground">Metas por categoria</h3>
        <span className="text-xs text-muted-foreground">· Real / Meta (sc/ha)</span>
      </div>

      {over.length > 0 ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Você ultrapassou a meta em{" "}
            <strong>
              {over.map((r) => CATEGORY_LABELS[r.category] ?? r.category).join(", ")}
            </strong>
            .
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const real = r.sacks_per_ha;
          const overOne = real > r.target;
          const pct = r.target > 0 ? Math.min(100, (real / r.target) * 100) : 0;
          const color = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.OTHER;
          return (
            <div key={r.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="truncate font-medium text-foreground">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    overOne ? "font-semibold text-danger-strong" : "text-foreground",
                  )}
                >
                  {num(real)} <span className="text-muted-foreground">/ {num(r.target)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    overOne && "bg-danger-strong",
                  )}
                  style={{ width: `${pct}%`, background: overOne ? undefined : color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
