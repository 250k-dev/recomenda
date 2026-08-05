"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Leaf, Plus, Search } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { useProducerCycles } from "@recomenda/api-hooks";
import type { CycleSummary } from "@recomenda/api/cycles";
import { CROP_LABELS } from "@recomenda/utils";
import { routes } from "@recomenda/config";

const CYCLE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function cycleHref(cycle: CycleSummary, producerId: string) {
  return routes.fazendas.safra(cycle.farm_id, cycle.id, {
    producer_id: producerId,
  });
}

/** Aba "Safras" da ficha do produtor — lista única (sem duplicar multi-fazenda). */
export function ProducerCyclesSection({
  producerId,
  anchorFarmId,
  toolbarLeading,
}: {
  producerId: string;
  /** Fazenda âncora para o POST de criação (primeira do produtor). */
  anchorFarmId: string | null;
  /** Slot à esquerda da barra (ex.: toggle Fazendas/Safras). */
  toolbarLeading?: ReactNode;
}) {
  const router = useRouter();
  const { data: cycles = [], isLoading } = useProducerCycles(producerId);
  const [search, setSearch] = useState("");
  const [newCycleOpen, setNewCycleOpen] = useState(false);

  const visible = useMemo(
    () => cycles.filter((c) => c.status !== "ARCHIVED"),
    [cycles],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    if (!q) return visible;
    return visible.filter((c) =>
      c.name.toLocaleLowerCase("pt-BR").includes(q),
    );
  }, [visible, search]);

  if (isLoading) return <ListCardsSkeleton count={3} />;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {toolbarLeading}
        <div className="hidden min-w-4 flex-1 sm:block" />
        {visible.length > 0 ? (
          <div className="relative w-full sm:w-60 lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar safra…"
              aria-label="Buscar safra"
              className="h-10 pl-9"
            />
          </div>
        ) : null}
        {anchorFarmId ? (
          <Button
            className="hidden h-10 gap-1.5 sm:inline-flex"
            onClick={() => setNewCycleOpen(true)}
          >
            <Plus className="size-4" />
            Nova safra
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhuma safra neste produtor."
          description="Crie a safra escolhendo as fazendas, monte a lista de compra e programe os talhões."
          action={
            anchorFarmId ? (
              <Button size="sm" onClick={() => setNewCycleOpen(true)}>
                Criar primeira safra
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="inline"
          title="Nenhuma safra encontrada."
          description={`Não há safras com o nome "${search.trim()}".`}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((cycle) => {
            const pct = cycle.progress_pct;
            const showProgress = cycle.recommendations_total > 0;
            const farmCount = cycle.farms?.length ?? 1;
            return (
              <Card
                key={cycle.id}
                className="gap-0 overflow-hidden p-0 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-hover/30"
                    onClick={() =>
                      router.push(cycleHref(cycle, producerId))
                    }
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                      <Leaf className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold text-text-strong">
                          {cycle.name}
                        </span>
                        {cycle.is_planning ? (
                          <Badge variant="neutral" className="shrink-0">
                            Em planejamento
                          </Badge>
                        ) : (
                          <Badge
                            variant={
                              cycle.status === "ACTIVE" ? "success" : "neutral"
                            }
                            className="shrink-0"
                          >
                            {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
                          </Badge>
                        )}
                        {cycle.awaiting_purchase ? (
                          <Badge variant="warning" className="shrink-0">
                            Aguardando compra
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {[
                          cycle.crops
                            .map((c) => CROP_LABELS[c] ?? c)
                            .join(" + "),
                          farmCount > 1
                            ? `${farmCount} fazendas`
                            : (cycle.farms?.[0]?.name ?? null),
                          cycle.is_planning
                            ? "sem talhões programados"
                            : `${cycle.plots_count} ${
                                cycle.plots_count === 1 ? "talhão" : "talhões"
                              }`,
                          cycle.area_ha > 0
                            ? `${fmtHa(cycle.area_ha)} ha`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {showProgress ? (
                      <span className="hidden w-56 shrink-0 lg:block">
                        <span className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {cycle.recommendations_done}/
                            {cycle.recommendations_total} aplicadas
                          </span>
                          <span className="font-semibold tabular-nums text-primary-strong">
                            {pct}%
                          </span>
                        </span>
                        <ProgressBar
                          value={pct}
                          className="h-1.5 bg-surface-2"
                        />
                      </span>
                    ) : null}
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {anchorFarmId ? (
        <>
          <StickyMobileCta>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setNewCycleOpen(true)}
            >
              <Plus className="size-4" />
              Nova safra
            </Button>
          </StickyMobileCta>
          <NewCycleDialog
            open={newCycleOpen}
            onOpenChange={setNewCycleOpen}
            farmId={anchorFarmId}
            producerId={producerId}
            onCreated={(cycleId) =>
              router.push(
                routes.fazendas.safra(anchorFarmId, cycleId, {
                  producer_id: producerId,
                }),
              )
            }
          />
        </>
      ) : null}
    </section>
  );
}
