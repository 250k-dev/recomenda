"use client";

import {
  ArrowUpRight,
  CircleCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Skeleton } from "@recomenda/ui/skeleton";
import { ProgressBar } from "@recomenda/ui/progress-bar";
import { Button } from "@recomenda/ui/button";
import { usePlanQuota } from "@recomenda/api-hooks";
import { cn } from "@recomenda/utils";

function formatBrlMonthly(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PlanQuotaPanel() {
  const { data, isLoading } = usePlanQuota();
  const plan = data?.plan;
  const usage = data?.quota_usage;
  const current = usage?.current ?? 0;
  const limit = usage?.limit ?? plan?.plot_quota ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const atLimit = limit > 0 && current >= limit;
  const isActive = plan?.is_active !== false;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-2 px-5 py-5 sm:px-[22px]">
        {isLoading ? (
          <div className="flex items-center gap-3.5" aria-hidden>
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <div className="font-display text-xl font-semibold text-text-strong">
                  Plano {plan?.name ?? "—"}
                </div>
                <div className="text-[13.5px] text-muted-foreground">
                  Valor de referência mensal:{" "}
                  <span className="font-semibold text-text-strong">
                    {plan ? formatBrlMonthly(plan.price_brl_monthly) : "—"}
                  </span>
                </div>
              </div>
            </div>
            {isActive ? (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary-border bg-primary-soft px-3 text-[12.5px] font-semibold text-primary-strong">
                <CircleCheck className="h-3.5 w-3.5" />
                Ativo
              </span>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-[22px] sm:py-[22px]">
        {isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14.5px] font-semibold text-text-strong">
                  Uso da quota de talhões
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Cada safra publicada ou em andamento conta no limite do plano
                  ({limit} talhão{limit === 1 ? "" : "ões"}).
                </p>
              </div>
              <span
                className={cn(
                  "font-display text-[22px] font-semibold tabular-nums",
                  atLimit ? "text-warning-strong" : "text-text-strong",
                )}
              >
                {current} / {limit}
              </span>
            </div>
            <ProgressBar
              value={pct}
              tone={atLimit ? "warning" : "primary"}
              className="h-2.5"
            />
            {atLimit ? (
              <p className="flex items-center gap-2 text-[13px] font-medium text-warning-strong">
                <TriangleAlert className="size-4 shrink-0" />
                Você atingiu o limite do plano. Para novas safras ativas,
                considere ampliar a quota.
              </p>
            ) : null}

            <div className="flex gap-3 rounded-[14px] border border-clay-border bg-clay-soft p-4">
              <span className="shrink-0 text-clay-strong">
                <TrendingUp className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-text-strong">
                  Quer mais talhões ou outro plano?
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Faça upgrade para acompanhar mais propriedades e safras em
                  paralelo, com previsibilidade de custo.
                </p>
                <Button variant="clay" className="mt-3 h-10 gap-2 px-[18px] text-[13.5px]">
                  <ArrowUpRight className="h-4 w-4" />
                  Falar sobre upgrade
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
