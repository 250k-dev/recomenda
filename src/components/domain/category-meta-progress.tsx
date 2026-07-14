"use client";

import { useMemo } from "react";
import { AlertTriangle, Target } from "lucide-react";
import { useCurrencyStore, DEFAULT_GRAIN_PRICE_BRL } from "@/stores/currency";
import { computePurchaseListMetrics } from "@/lib/purchase-list-breakdown";
import { CATEGORY_ORDER } from "@/lib/cost-plan/calculate";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";
import type { ListItem } from "@/components/domain/season/_shared";
import { cn } from "@/lib/utils";

/** Chave reservada no jsonb `category_targets` para a meta ÚNICA da lista, em
 *  sacas TOTAIS (formato novo). Sem essa chave, valem as metas por categoria
 *  em sc/ha (formato antigo — listas já criadas continuam funcionando). */
export const TOTAL_TARGET_KEY = "TOTAL";

const num = (n: number, d = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: d });

/**
 * Progresso das metas da lista de compra, com aviso ao estourar.
 *
 * - Meta nova (`TOTAL`, sacas totais): barra única Real × Meta.
 * - Metas antigas (por categoria, sc/ha): tabela de progresso por categoria.
 *
 * Só aparece quando há meta definida — sem meta, não renderiza nada.
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

  // Formato novo: meta única em sacas totais — compara direto com o volume de
  // sacas que a lista já calcula (mesmo número do KPI "Volume de sacas").
  const totalTarget = Number(targets[TOTAL_TARGET_KEY] ?? 0);
  if (totalTarget > 0) {
    const real = metrics.totalSacks;
    const over = real > totalTarget;
    const pct = Math.min(100, (real / totalTarget) * 100);
    return (
      <section className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Target className="h-4 w-4 text-primary-strong" />
          <h3 className="text-sm font-semibold text-foreground">Meta de sacas</h3>
          <span className="text-xs text-muted-foreground">· Real / Meta (sacas totais)</span>
        </div>

        {over ? (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Você ultrapassou a meta em{" "}
              <strong>{num(real - totalTarget)} sacas</strong>.
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-foreground">Total da lista</span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                over ? "font-semibold text-danger-strong" : "text-foreground",
              )}
            >
              {num(real)}{" "}
              <span className="text-muted-foreground">/ {num(totalTarget)} sc</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-all",
                over && "bg-danger-strong",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>
    );
  }

  // Formato antigo (por categoria, sc/ha). Parte de TODAS as metas configuradas
  // (não só das categorias que já têm item): assim toda meta aparece desde o
  // começo e o "Real" sobe de 0 conforme o agrônomo vai preenchendo produtos.
  const realByCategory = new Map(
    metrics.categoryBreakdown.map((r) => [r.category, r.sacks_per_ha]),
  );
  const rows = Object.entries(targets)
    .filter(([category, target]) => category !== TOTAL_TARGET_KEY && (target ?? 0) > 0)
    .map(([category, target]) => ({
      category,
      target,
      sacks_per_ha: realByCategory.get(category) ?? 0,
    }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

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
