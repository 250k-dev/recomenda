"use client";

import { Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/ui/progress-bar";
import { usePlanQuota } from "@/lib/api/hooks";

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

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardHeader className="border-b border-border bg-surface-2 px-6 pb-5 pt-5">
        {isLoading ? (
          <div className="flex items-center gap-3.5" aria-hidden>
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <div className="font-display text-xl font-semibold text-text-strong">
                {plan?.name ?? "Plano"}
              </div>
              <div className="text-sm text-muted-foreground">
                Valor de referência mensal:{" "}
                <span className="font-semibold text-text-strong">
                  {plan ? formatBrlMonthly(plan.price_brl_monthly) : "—"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-6">
        {isLoading ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-strong">
                  Uso da quota de talhões
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada safra publicada ou em andamento conta no limite do plano
                  ({limit} talhão{limit === 1 ? "" : "ões"}).
                </p>
              </div>
              <span
                className={
                  "font-display text-2xl font-semibold tabular-nums " +
                  (atLimit ? "text-warning-strong" : "text-text-strong")
                }
              >
                {current} / {limit}
              </span>
            </div>
            <ProgressBar value={pct} tone={atLimit ? "warning" : "primary"} />
            {atLimit ? (
              <p className="flex items-center gap-2 text-sm font-medium text-warning-strong">
                <TriangleAlert className="size-4 shrink-0" />
                Você atingiu o limite do plano. Para novas safras ativas,
                considere ampliar a quota.
              </p>
            ) : null}

            <div className="mt-2 flex gap-3 rounded-xl border border-clay-border bg-clay-soft p-4">
              <span className="shrink-0 text-clay-strong">
                <TrendingUp className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-strong">
                  Quer mais talhões ou outro plano?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Faça upgrade para acompanhar mais propriedades e safras em
                  paralelo, com previsibilidade de custo. Fale com o time
                  Recomenda para encontrar o melhor pacote.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
      {!isLoading ? (
        <CardFooter className="border-t border-border bg-surface-2/60 px-6 py-4 text-xs text-muted-foreground">
          Alterações de plano são feitas pelo time Recomenda. Mantenha seus dados
          atualizados em{" "}
          <strong className="font-medium text-text-strong">Meu perfil</strong>{" "}
          para facilitar o contato.
        </CardFooter>
      ) : null}
    </Card>
  );
}
