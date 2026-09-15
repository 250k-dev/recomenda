"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, History, Leaf, Plus, Search, UserRound } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import { Input } from "@recomenda/ui/primitives/input";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { toast } from "sonner";
import { useProducer, useProducerCycles, useProducerFarms, useCan } from "@recomenda/api-hooks";
import type { CycleSummary } from "@recomenda/api/cycles";
import { routes } from "@recomenda/config";
import { CROP_LABELS, CYCLE_STATUS_LABELS, labelStatus } from "@recomenda/utils";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { ProducerDetailSkeleton } from "@/components/domain/page-skeletons";
import { ProducerHistoryCyclePanel } from "@/components/domain/producer-history-cycle-panel";
import { NewCycleDialog } from "@/components/domain/farm-cycles-section";
import { HistoricalCycleFlag } from "@/components/domain/historical-cycle-flag";
import {
  INVERTED_HERO_CTA_CLASS,
} from "@/components/domain/export-action-class";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type DetailTab = "safra" | "estoque";

function closeDate(cycle: CycleSummary): Date | null {
  const iso = cycle.closed_at ?? cycle.created_at;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function closeYear(cycle: CycleSummary): string {
  const d = closeDate(cycle);
  return d ? String(d.getFullYear()) : "—";
}

function fmtClosed(cycle: CycleSummary): string {
  const d = closeDate(cycle);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cycleCrops(cycle: CycleSummary): string {
  return cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + ");
}

function farmsLabel(cycle: CycleSummary): string {
  const n = cycle.farms?.length ?? 1;
  if (n === 1) return cycle.farms?.[0]?.name ?? "1 fazenda";
  return `${n} fazendas`;
}

function groupByYear(cycles: CycleSummary[]) {
  const map = new Map<string, CycleSummary[]>();
  for (const cycle of cycles) {
    const year = closeYear(cycle);
    const list = map.get(year) ?? [];
    list.push(cycle);
    map.set(year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0], "pt-BR"))
    .map(([ano, list]) => ({
      ano,
      cycles: list.sort((a, b) => {
        const da = closeDate(a)?.getTime() ?? 0;
        const db = closeDate(b)?.getTime() ?? 0;
        return db - da;
      }),
    }));
}

export function ProducerHistoryView({
  producerId,
  tab,
  cycleId,
}: {
  producerId: string;
  tab: DetailTab;
  cycleId: string | null;
}) {
  const router = useRouter();
  const { data: producer, isLoading } = useProducer(producerId);
  const { data: cycles = [], isLoading: loadingCycles } =
    useProducerCycles(producerId);
  const { data: producerFarms = [] } = useProducerFarms(producerId);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("todos");
  const [addOpen, setAddOpen] = useState(false);
  const canAdd = useCan("CYCLE_CRUD");
  const anchorFarmId = producerFarms[0]?.id ?? "";

  const closed = useMemo(
    () =>
      cycles.filter(
        (c) =>
          c.backfill || c.status === "HARVESTED" || c.status === "ARCHIVED",
      ),
    [cycles],
  );

  const harvestedCount = closed.filter((c) => c.status === "HARVESTED").length;
  const archivedCount = closed.filter((c) => c.status === "ARCHIVED").length;
  const oldest = useMemo(() => {
    if (closed.length === 0) return null;
    return [...closed].sort((a, b) => {
      const da = closeDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const db = closeDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - db;
    })[0];
  }, [closed]);

  const years = useMemo(() => {
    const set = new Set(closed.map(closeYear).filter((y) => y !== "—"));
    return ["todos", ...[...set].sort((a, b) => b.localeCompare(a, "pt-BR"))];
  }, [closed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return closed.filter((c) => {
      if (year !== "todos" && closeYear(c) !== year) return false;
      if (!q) return true;
      return (
        c.name.toLocaleLowerCase("pt-BR").includes(q) ||
        cycleCrops(c).toLocaleLowerCase("pt-BR").includes(q)
      );
    });
  }, [closed, search, year]);

  const groups = useMemo(() => groupByYear(filtered), [filtered]);

  const replaceHistory = (next: {
    cycleId?: string | null;
    tab?: DetailTab;
  }) => {
    const nextCycle = next.cycleId === undefined ? cycleId : next.cycleId;
    const nextTab = next.tab ?? tab;
    router.replace(
      routes.produtores.historico(producerId, {
        cycle_id: nextCycle,
        tab: nextCycle && nextTab === "estoque" ? "estoque" : null,
      }),
    );
  };

  if (isLoading) return <ProducerDetailSkeleton />;
  if (!producer) {
    return (
      <p className="p-6 text-sm text-destructive">Produtor não encontrado.</p>
    );
  }

  const producerHref = routes.produtores.detalhe(producerId);
  const emptySearch = search.trim().length > 0 || year !== "todos";

  if (cycleId) {
    return (
      <ProducerHistoryCyclePanel
        producerId={producerId}
        cycleId={cycleId}
        tab={tab}
        onTabChange={(next) => replaceHistory({ tab: next })}
        onBack={() => replaceHistory({ cycleId: null, tab: "safra" })}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <BreadcrumbBack
        items={[
          { label: "Produtores", href: routes.produtores.lista },
          { label: producer.name, href: producerHref },
          { label: "Histórico" },
        ]}
      />

      <PageHero
        variant="inverted"
        icon={<UserRound className="size-6" />}
        eyebrow="Produtor · Histórico"
        title={producer.name}
        actions={
          canAdd ? (
            <Button
              className={`gap-2 ${INVERTED_HERO_CTA_CLASS}`}
              onClick={() => {
                if (!anchorFarmId) {
                  toast.error(
                    "Cadastre uma fazenda neste produtor antes de lançar o arquivo.",
                  );
                  return;
                }
                setAddOpen(true);
              }}
            >
              <Plus className="size-4" />
              Safra antiga
            </Button>
          ) : undefined
        }
        stats={[
          { label: "Safras encerradas", value: closed.length },
          { label: "Colhidas", value: harvestedCount },
          { label: "Removidas", value: archivedCount },
          {
            label: "Primeira safra",
            value: oldest?.name ?? "—",
          },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar safra encerrada..."
            aria-label="Buscar safra encerrada"
            className="h-10 pl-9"
          />
        </div>
        {years.length > 1 ? (
          <SegmentedTabs
            value={year}
            onValueChange={setYear}
            items={years.map((y) => ({
              value: y,
              label: y === "todos" ? "Todos" : y,
            }))}
          />
        ) : null}
      </div>

      {loadingCycles ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-surface-2"
            />
          ))}
        </div>
      ) : closed.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma safra encerrada ainda"
          description="Lance safras passadas pelo mesmo fluxo da safra atual (programação, lista e galpão do arquivo)."
          action={
            canAdd ? (
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="size-4" />
                Safra antiga
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={producerHref}>Voltar ao produtor</Link>
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          variant="inline"
          title="Nenhuma safra encontrada"
          description={
            emptySearch
              ? "Ajuste a busca ou o filtro de ano para encontrar a safra."
              : "Não há safras encerradas neste recorte."
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.ano}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold tracking-wide text-text-strong">
                  {group.ano}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {group.cycles.length}{" "}
                  {group.cycles.length === 1 ? "safra" : "safras"}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2.5">
                {group.cycles.map((cycle) => (
                  <Card
                    key={cycle.id}
                    className="gap-0 overflow-hidden p-0 transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <CardContent className="p-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 px-4 py-4 text-left"
                        onClick={() =>
                          replaceHistory({ cycleId: cycle.id, tab: "safra" })
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
                            {cycle.backfill ? <HistoricalCycleFlag /> : null}
                            <Badge
                              variant={
                                cycle.backfill
                                  ? "neutral"
                                  : cycle.status === "HARVESTED"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {cycle.backfill
                                ? "Em preenchimento"
                                : labelStatus(CYCLE_STATUS_LABELS, cycle.status)}
                            </Badge>
                          </span>
                          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                            {cycleCrops(cycle)}
                          </span>
                        </span>
                        <span className="hidden gap-8 sm:flex">
                          <span>
                            <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">
                              FAZENDAS
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {farmsLabel(cycle)}
                            </span>
                          </span>
                          <span>
                            <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">
                              ÁREA
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {cycle.area_ha > 0
                                ? `${fmtHa(cycle.area_ha)} ha`
                                : "—"}
                            </span>
                          </span>
                          <span>
                            <span className="block text-[11px] font-semibold tracking-wide text-muted-foreground">
                              ENCERRADA
                            </span>
                            <span className="text-sm font-semibold tabular-nums">
                              {fmtClosed(cycle)}
                            </span>
                          </span>
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {anchorFarmId ? (
        <NewCycleDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          farmId={anchorFarmId}
          producerId={producerId}
          defaultDestination="historical"
        />
      ) : null}
    </div>
  );
}
