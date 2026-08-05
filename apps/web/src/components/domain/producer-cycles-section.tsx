"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Leaf, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import {
  useCan,
  useDeleteCycle,
  useProducerCycles,
} from "@recomenda/api-hooks";
import type { CycleSummary } from "@recomenda/api/cycles";
import { CROP_LABELS } from "@recomenda/utils";
import { routes } from "@recomenda/config";
import { extractError } from "@/components/domain/season/_shared";

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
  const deleteCycle = useDeleteCycle();
  const canDeleteCycle = useCan("CYCLE_CRUD");
  const [search, setSearch] = useState("");
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CycleSummary | null>(null);

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
                  <div className="flex w-full items-center gap-2 px-2 py-2 sm:gap-3.5 sm:px-4 sm:py-4">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover/30"
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
                                cycle.status === "ACTIVE"
                                  ? "success"
                                  : "neutral"
                              }
                              className="shrink-0"
                            >
                              {CYCLE_STATUS_LABELS[cycle.status] ??
                                cycle.status}
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
                                  cycle.plots_count === 1
                                    ? "talhão"
                                    : "talhões"
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
                    {canDeleteCycle ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Excluir safra ${cycle.name}`}
                        onClick={() => setPendingDelete(cycle)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  {showProgress ? (
                    <div className="border-t border-border bg-rail px-4 py-3 lg:hidden">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {cycle.recommendations_done}/
                          {cycle.recommendations_total} aplicadas
                        </span>
                        <span className="font-semibold tabular-nums text-primary-strong">
                          {pct}%
                        </span>
                      </div>
                      <ProgressBar
                        value={pct}
                        className="h-1.5 bg-surface-2"
                      />
                    </div>
                  ) : null}
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
                routes.fazendas.novaListaDeCompra(anchorFarmId, {
                  producer_id: producerId,
                  cycle_id: cycleId,
                }),
              )
            }
          />
        </>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete
            ? `Excluir a safra "${pendingDelete.name}"?`
            : "Excluir safra?"
        }
        description={
          pendingDelete ? (
            <CycleDeleteDescription cycle={pendingDelete} />
          ) : undefined
        }
        confirmLabel="Excluir safra"
        tone="destructive"
        loading={deleteCycle.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteCycle.mutateAsync(pendingDelete.id);
            toast.success("Safra excluída.");
            setPendingDelete(null);
          } catch (e) {
            toast.error(
              extractError(e) || "Não foi possível excluir a safra.",
            );
          }
        }}
      />
    </section>
  );
}

function CycleDeleteDescription({ cycle }: { cycle: CycleSummary }) {
  const hasRecommendations = cycle.recommendations_total > 0;
  const hasPurchaseList = Boolean(cycle.purchase_list_id);
  const hasLinkedData = hasRecommendations || hasPurchaseList;

  if (!hasLinkedData) {
    return (
      <>
        A safra será removida da carteira. Esta ação não pode ser desfeita.
      </>
    );
  }

  const parts: string[] = [];
  if (hasRecommendations) {
    parts.push(
      `${cycle.recommendations_total} ${
        cycle.recommendations_total === 1
          ? "recomendação"
          : "recomendações"
      }`,
    );
  }
  if (hasPurchaseList) {
    parts.push("a lista de compra vinculada");
  }

  return (
    <>
      Esta safra possui {parts.join(" e ")}. Ao confirmar,{" "}
      <strong className="font-semibold text-foreground">
        tudo será excluído
      </strong>{" "}
      junto com a programação dos talhões. Esta ação não pode ser desfeita.
    </>
  );
}
