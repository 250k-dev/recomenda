"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, Leaf } from "lucide-react";

import { routes } from "@recomenda/config";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { useProducer, useProducerCycles } from "@recomenda/api-hooks";
import type { CycleSummary } from "@recomenda/api/cycles";
import { CROP_LABELS } from "@recomenda/utils";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

function cycleSubtitle(cycle: CycleSummary): string {
  const farmCount = cycle.farms?.length ?? 1;
  return [
    cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + "),
    farmCount > 1 ? `${farmCount} fazendas` : (cycle.farms?.[0]?.name ?? null),
    cycle.plots_count > 0
      ? `${cycle.plots_count} ${cycle.plots_count === 1 ? "talhão" : "talhões"}`
      : null,
    cycle.area_ha > 0 ? `${fmtHa(cycle.area_ha)} ha` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ProducerArchivedSeasonsPage() {
  const params = useParams<{ id: string }>();
  const producerId = params.id;

  const { data: producer } = useProducer(producerId);
  const { data: cycles = [], isLoading } = useProducerCycles(producerId);

  const archived = useMemo(
    () => cycles.filter((c) => c.status === "ARCHIVED"),
    [cycles],
  );

  const producerHref = routes.produtores.detalhe(producerId);

  return (
    <div className="animate-fade-in space-y-6">
      <BreadcrumbBack
        items={[
          { label: "Produtores", href: routes.produtores.lista },
          { label: producer?.name ?? "Produtor", href: producerHref },
          { label: "Safras arquivadas" },
        ]}
      />

      <section className="overflow-hidden rounded-xl border border-border bg-linear-to-br from-muted/40 to-card shadow-sm">
        <div className="flex flex-col gap-1 p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Archive className="size-3.5" />
            Arquivadas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Safras arquivadas
          </h1>
          <p className="text-sm text-muted-foreground">
            Safras removidas da carteira{producer ? ` de ${producer.name}` : ""}.
            Ficam guardadas aqui como histórico.
          </p>
        </div>
      </section>

      {isLoading ? (
        <ListCardsSkeleton count={3} />
      ) : archived.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhuma safra arquivada"
          description="Quando uma safra for removida da carteira, ela aparecerá aqui."
          action={
            <Button asChild variant="outline">
              <Link href={producerHref}>Voltar ao produtor</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {archived.map((cycle) => {
            const archivedAt = fmtDate(cycle.created_at);
            return (
              <Card
                key={cycle.id}
                className="gap-0 overflow-hidden p-0 transition-all hover:border-border"
              >
                <CardContent className="p-0">
                  <div className="flex w-full items-center gap-3.5 px-4 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Leaf className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-text-strong">
                          {cycle.name}
                        </span>
                        <Badge variant="neutral" className="shrink-0">
                          Arquivada
                        </Badge>
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {cycleSubtitle(cycle)}
                      </span>
                    </span>
                    {archivedAt ? (
                      <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                        Criada em
                        <br />
                        <span className="font-medium text-foreground">
                          {archivedAt}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
