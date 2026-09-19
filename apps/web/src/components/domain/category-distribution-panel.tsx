"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recomenda/ui/primitives/collapsible";
import { cn } from "@recomenda/utils";
import { CATEGORY_ORDER } from "@recomenda/domain/cost-plan/calculate";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@recomenda/domain/cost-plan/categories";
import type { CategoryBreakdown } from "@recomenda/domain/cost-plan/calculate";

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
 * - **Prop `targets` presente (lista de compra):** tabela Realizado × Meta
 *   (R$ e sc/ha). Sempre o mesmo layout — sem meta, a coluna Meta fica vazia e a
 *   barra some; com meta, aparece o progresso (vermelho ao estourar).
 * - **Prop `targets` ausente (plano de custo):** distribuição de gastos (fatia %
 *   + valor por segmento, com toggle R$ / sacas/ha).
 */
export function CategoryDistributionPanel({
  breakdown,
  targets,
  defaultMode = "brl",
  action,
  collapsible = false,
}: {
  breakdown: CategoryBreakdown[];
  targets?: Record<string, number>;
  defaultMode?: "brl" | "sacks";
  /** Ação no canto do header do card (ex.: "Editar metas" na lista de compra). */
  action?: ReactNode;
  /** Card recolhível: começa fechado, com botão de abrir/fechar no header. */
  collapsible?: boolean;
}) {
  // A lista de compra sempre passa `targets` (mesmo vazio) → tabela unificada.
  // O plano de custo não passa → distribuição de gastos com toggle.
  if (targets !== undefined) {
    return (
      <MetaView
        breakdown={breakdown}
        targets={targets}
        action={action}
        collapsible={collapsible}
      />
    );
  }
  return (
    <SpendView
      breakdown={breakdown}
      defaultMode={defaultMode}
      action={action}
      collapsible={collapsible}
    />
  );
}

/** Abre/fecha o card recolhível — seta para baixo fechado, para cima aberto. */
function CollapseToggle({ open }: { open: boolean }) {
  return (
    <CollapsibleTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={
          open ? "Recolher gastos por categoria" : "Expandir gastos por categoria"
        }
      >
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </Button>
    </CollapsibleTrigger>
  );
}

/** Realizado (R$ e sc/ha) × Meta por categoria, em tabela com barra de progresso. */
function MetaView({
  breakdown,
  targets,
  action,
  collapsible,
}: {
  breakdown: CategoryBreakdown[];
  targets: Record<string, number>;
  action?: ReactNode;
  collapsible: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const byCat = new Map(breakdown.map((b) => [b.category, b]));
  // Linhas = união das categorias com gasto (breakdown) e com meta definida.
  // Assim o layout é o mesmo com ou sem metas: sem meta a linha ainda aparece
  // (Realizado preenchido, Meta vazia); com meta, mostra o progresso.
  const categories = new Set<string>(breakdown.map((b) => b.category));
  for (const [category, target] of Object.entries(targets)) {
    if ((target ?? 0) > 0) categories.add(category);
  }
  const hasAnyTarget = Object.values(targets).some((v) => (v ?? 0) > 0);
  const rows = sortByCategory(
    [...categories].map((category) => {
      const b = byCat.get(category);
      return {
        category,
        target: targets[category] ?? 0,
        real: b?.sacks_per_ha ?? 0,
        totalBrl: b?.total_brl ?? 0,
      };
    }),
  );

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Gastos por categoria</h3>
            <p className="text-xs text-muted-foreground">
              {hasAnyTarget
                ? "Realizado em R$ e sc/ha, comparado à meta do agrônomo"
                : "Realizado em R$ e sc/ha — defina metas para acompanhar o progresso"}
            </p>
          </div>
          {action || collapsible ? (
            <div className="flex items-center gap-2">
              {action}
              {collapsible ? <CollapseToggle open={open} /> : null}
            </div>
          ) : null}
        </div>

        {rows.length === 0 ? (
          // Sem gasto nem meta: o card continua na tela (a lista de compra o
          // mostra sempre), só com o recado no lugar da tabela vazia.
          <CollapsibleContent asChild>
            <p className="mt-3 text-sm text-muted-foreground">
              Informe os preços dos produtos da lista, ou defina as metas da
              safra.
            </p>
          </CollapsibleContent>
        ) : (
          <CollapsibleContent asChild>
            <div className="mt-3 overflow-x-auto">
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
                    const hasTarget = r.target > 0;
                    const overOne = hasTarget && r.real > r.target;
                    const progress = hasTarget ? (r.real / r.target) * 100 : 0;
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
                          {hasTarget ? (
                            <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium tabular-nums text-primary-strong">
                              {num(r.target)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3">
                          {hasTarget ? (
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
                          ) : (
                            <span className="text-xs text-muted-foreground/50">
                              Sem meta definida
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        )}
      </section>
    </Collapsible>
  );
}

/** Distribuição de gastos (fatia % + valor) com toggle R$ / sacas/ha. */
function SpendView({
  breakdown,
  defaultMode,
  action,
  collapsible,
}: {
  breakdown: CategoryBreakdown[];
  defaultMode: "brl" | "sacks";
  action?: ReactNode;
  collapsible: boolean;
}) {
  const [mode, setMode] = useState<"brl" | "sacks">(defaultMode);
  const [open, setOpen] = useState(!collapsible);
  const rows = sortByCategory(breakdown);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold text-foreground">Gastos por categoria</h3>
        {action}
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
        {collapsible ? <CollapseToggle open={open} /> : null}
      </div>
      {rows.length === 0 ? (
        <CollapsibleContent asChild>
          <p className="mt-3 text-sm text-muted-foreground">
            Informe preços para ver os gastos por categoria.
          </p>
        </CollapsibleContent>
      ) : (
        <CollapsibleContent asChild>
          <ul className="mt-3 flex flex-col gap-3">
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
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
