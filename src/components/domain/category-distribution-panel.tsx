"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORY_ORDER } from "@/lib/cost-plan/calculate";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/cost-plan/categories";
import type { CategoryBreakdown } from "@/lib/cost-plan/calculate";

const brlSmall = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number, digits = 2) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: digits });

function sortByCategory<T extends { category: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a.category);
    const ib = CATEGORY_ORDER.indexOf(b.category);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

/**
 * Painel de categorias no topo da lista de compra / plano de custo.
 *
 * - **Sem metas:** distribuição de gastos (fatia % + valor por segmento, com
 *   toggle R$ / sacas/ha). É o que o plano de custo usa.
 * - **Com metas** (definidas pelo agrônomo antes de montar a lista): vira o
 *   acompanhamento Real × Meta (sc/ha) — uma barra de progresso por categoria,
 *   vermelha ao estourar, com aviso. Sem gasto duplicado, sem toggle (meta é sc/ha).
 */
export function CategoryDistributionPanel({
  breakdown,
  targets,
  defaultMode = "brl",
}: {
  breakdown: CategoryBreakdown[];
  targets?: Record<string, number>;
  defaultMode?: "brl" | "sacks";
}) {
  const targetMap = targets ?? {};
  const hasTargets = Object.values(targetMap).some((v) => (v ?? 0) > 0);

  if (hasTargets) {
    return <MetaView breakdown={breakdown} targets={targetMap} />;
  }
  return <SpendView breakdown={breakdown} defaultMode={defaultMode} />;
}

/** Realizado (R$ e sc/ha) × Meta por categoria, em tabela com barra de progresso. */
function MetaView({
  breakdown,
  targets,
}: {
  breakdown: CategoryBreakdown[];
  targets: Record<string, number>;
}) {
  const byCat = new Map(breakdown.map((b) => [b.category, b]));
  const rows = sortByCategory(
    Object.entries(targets)
      .filter(([, target]) => (target ?? 0) > 0)
      .map(([category, target]) => {
        const b = byCat.get(category);
        return {
          category,
          target,
          real: b?.sacks_per_ha ?? 0,
          totalBrl: b?.total_brl ?? 0,
        };
      }),
  );

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-foreground">Gastos por categoria</h3>
        <p className="text-xs text-muted-foreground">
          Realizado em R$ e sc/ha, comparado à meta do agrônomo
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-3 pr-3 text-left font-medium">Categoria</th>
              <th className="px-3 py-2 text-right font-medium">Realizado R$</th>
              <th className="px-3 py-2 text-right font-medium">Realizado sc/ha</th>
              <th className="px-3 py-2 text-center font-medium">Meta sc/ha</th>
              <th className="w-[36%] min-w-[160px] py-2 pl-3 text-left font-medium">
                Progresso
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const color = CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.OTHER;
              const overOne = r.real > r.target;
              const progress = r.target > 0 ? (r.real / r.target) * 100 : 0;
              return (
                <tr
                  key={r.category}
                  className={cn(
                    "border-t border-border/60",
                    overOne && "bg-danger-soft",
                  )}
                >
                  <td
                    className={cn(
                      "whitespace-nowrap border-l-[3px] py-2.5 pl-3 pr-3 font-medium text-foreground",
                      overOne
                        ? "border-l-danger-strong font-semibold"
                        : "border-l-transparent",
                    )}
                  >
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-right tabular-nums",
                      overOne ? "text-danger" : "text-muted-foreground",
                    )}
                  >
                    {brlSmall(r.totalBrl)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums",
                      overOne ? "text-danger-strong" : "text-foreground",
                    )}
                  >
                    {num(r.real, 1)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary-strong">
                      {num(r.target)}
                    </span>
                  </td>
                  <td className="py-2.5 pl-3">
                    <div className="flex items-center gap-2.5">
                      {/* Barra: 100% = meta (marcador à direita); enche até o realizado. */}
                      <div className="relative min-w-[80px] flex-1">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              overOne && "bg-danger-strong",
                            )}
                            style={{
                              width: `${Math.min(100, progress)}%`,
                              background: overOne ? undefined : color,
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full",
                            overOne ? "bg-danger-strong" : "bg-primary-strong",
                          )}
                          style={{ left: "calc(100% - 2px)" }}
                        />
                      </div>
                      <span
                        className={cn(
                          "w-11 shrink-0 text-right text-xs tabular-nums",
                          overOne
                            ? "font-semibold text-danger-strong"
                            : "text-muted-foreground",
                        )}
                      >
                        {num(progress, 0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Distribuição de gastos (fatia % + valor) com toggle R$ / sacas/ha. */
function SpendView({
  breakdown,
  defaultMode,
}: {
  breakdown: CategoryBreakdown[];
  defaultMode: "brl" | "sacks";
}) {
  const [mode, setMode] = useState<"brl" | "sacks">(defaultMode);
  const rows = sortByCategory(breakdown);
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
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Informe preços para ver os gastos por categoria.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((it) => {
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
