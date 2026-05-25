"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanQuota } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

function formatBrlMonthly(value: string): string {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PlanPage() {
  const { data, isLoading } = usePlanQuota();
  const plan = data?.plan;
  const usage = data?.quota_usage;
  const current = usage?.current ?? 0;
  const limit = usage?.limit ?? plan?.plot_quota ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;

  return (
    <>
      <PageHeader
        title="Plano e quota"
        description="Seu plano contratado e o uso de talhões em safras ativas (publicadas ou em andamento)."
      />
      <Card className="gap-0 p-0">
        <CardHeader className="border-b border-border bg-muted/30 px-6 pb-4 pt-6">
          {isLoading ? (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <>
              <CardTitle className="text-xl">{plan?.name ?? "Plano"}</CardTitle>
              <CardDescription>
                Valor de referência mensal:{" "}
                <span className="font-medium text-foreground">
                  {plan ? formatBrlMonthly(plan.price_brl_monthly) : "—"}
                </span>
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-6">
          {isLoading ? (
            <div className="space-y-3" aria-hidden>
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-foreground">Uso da quota de talhões</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada safra <strong className="font-medium text-foreground">publicada</strong> ou{" "}
                  <strong className="font-medium text-foreground">em andamento</strong> conta em relação ao limite do
                  seu plano ({limit} talhão{limit === 1 ? "" : "ões"}).
                </p>
                <div className="mt-4">
                  <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Em uso</span>
                    <span className="tabular-nums font-semibold text-foreground">
                      {current} / {limit}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={current}
                    aria-valuemin={0}
                    aria-valuemax={limit}
                    aria-label="Quota de talhões em uso"
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        pct >= 90 ? "bg-sun" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {limit > 0 && current >= limit ? (
                    <p className="mt-2 text-xs text-sun">
                      Você atingiu o limite do plano. Para novas safras ativas, considere ampliar a quota.
                    </p>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4 dark:bg-primary/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Quer mais talhões ou outro plano?</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Faça upgrade para acompanhar mais propriedades e safras em paralelo, com previsibilidade de custo.
                    Nossa equipe indica o melhor pacote para o tamanho do seu escritório.
                  </p>
                  <Button variant="outline" size="sm" className="mt-1 gap-1.5" asChild>
                    <Link href="/settings">
                      Solicitar upgrade
                      <ArrowUpRight className="size-3.5 opacity-70" />
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
        {!isLoading ? (
          <CardFooter className="border-t border-border bg-muted/20 px-6 py-4 text-xs text-muted-foreground">
            Alterações de plano são feitas pelo time Recomenda. Em{" "}
            <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Configurações
            </Link>{" "}
            você mantém seus dados atualizados para contato.
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
}
