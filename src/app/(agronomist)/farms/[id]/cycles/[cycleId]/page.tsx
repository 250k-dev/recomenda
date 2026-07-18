"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Leaf,
  ListChecks,
  Plus,
  Rocket,
  ShoppingCart,
  SquareCheckBig,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { PageHero, type PageHeroStat } from "@/components/domain/page-hero";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { CycleBlockWizard } from "@/components/domain/cycle-block-wizard";
import { CycleCostPlanView } from "@/components/domain/cycle-cost-plan-view";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import {
  useArchiveSeason,
  useCycle,
  useCyclePurchaseList,
  useFarm,
  useProducer,
  usePublishCycle,
} from "@/lib/api/hooks";
import type { CycleSeasonRow } from "@/lib/api/cycles";
import {
  CROP_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
} from "@/lib/season-constants";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/use-can";

type CycleTab = "recommendations" | "purchase" | "cost-plan";

const CYCLE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function parseCycleTab(value: string | null): CycleTab {
  if (value === "purchase" || value === "cost-plan") return value;
  return "recommendations";
}

/** Nome de exibição da programação: cultura + variedade(s). */
function seasonDisplayName(season: CycleSeasonRow): string {
  const varietyNames = (season.varieties ?? [])
    .map((v) => v.variety)
    .filter(Boolean);
  const varietyLabel =
    varietyNames.length > 0 ? varietyNames.join(" + ") : (season.variety ?? "");
  return `${CROP_LABELS[season.crop] ?? season.crop}${
    varietyLabel ? ` — ${varietyLabel}` : ""
  }`;
}

export default function CycleDetailPage() {
  const canListCrud = useCan("LIST_CRUD");
  const params = useParams<{ id: string; cycleId: string }>();
  const farmId = params.id;
  const cycleId = params.cycleId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerIdParam = searchParams.get("producer_id");
  const tab = parseCycleTab(searchParams.get("tab"));

  const { data: cycle, isLoading } = useCycle(cycleId);
  const { data: farm } = useFarm(farmId);
  const producerId = producerIdParam ?? cycle?.producer_id ?? "";
  const { data: producer } = useProducer(producerId);
  const { data: purchaseList, isLoading: loadingList } =
    useCyclePurchaseList(cycleId);
  const publishCycle = usePublishCycle(cycleId);
  const archiveSeason = useArchiveSeason();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [plotFilter, setPlotFilter] = useState("");

  const setTab = useCallback(
    (next: CycleTab) => {
      const qs = new URLSearchParams(searchParams.toString());
      qs.set("tab", next);
      router.replace(`?${qs.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const seasons = useMemo(() => cycle?.seasons ?? [], [cycle]);
  const draftSeasons = seasons.filter((s) => s.status === "DRAFT");
  const totalRecs = seasons.reduce(
    (s, row) => s + row.recommendations_total,
    0,
  );
  const doneRecs = seasons.reduce((s, row) => s + row.recommendations_done, 0);
  const progressPct =
    totalRecs > 0 ? Math.round((doneRecs / totalRecs) * 100) : 0;
  const areaByPlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seasons) {
      map.set(s.plot_id, s.planted_area_ha ?? s.plot_area_ha);
    }
    return map;
  }, [seasons]);
  const totalArea = [...areaByPlot.values()].reduce((s, v) => s + v, 0);
  // Conta as programações realmente listadas (uma por linha). areaByPlot deduplica
  // por plot_id — quando o mesmo talhão tem duas culturas/ciclos na safra ele
  // aparece em duas linhas, então o contador precisa bater com o que está na tela
  // (e com o chip do bloco), não com o nº de talhões físicos distintos.
  const plotCount = seasons.length;
  const filteredSeasons = useMemo(() => {
    const query = plotFilter.trim().toLocaleLowerCase("pt-BR");
    if (!query) return seasons;
    return seasons.filter((season) =>
      season.plot_name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [plotFilter, seasons]);

  const farmHref = producerIdParam
    ? `/farms/${farmId}?producer_id=${encodeURIComponent(producerIdParam)}`
    : `/farms/${farmId}`;
  const stockHref = `${farmHref}${farmHref.includes("?") ? "&" : "?"}tab=stock`;
  const newPurchaseListHref = `/farms/${farmId}/purchase-list/new?cycle_id=${encodeURIComponent(cycleId)}${
    producerId ? `&producer_id=${encodeURIComponent(producerId)}` : ""
  }`;

  // Lista em rascunho: abrir a aba de compra retoma o wizard direto (continua o
  // fluxo de onde parou), sem tela intermediária. Ao finalizar vira `active` e a
  // aba mostra a lista normal; ao salvar rascunho voltamos para a aba padrão
  // (recommendations), então não há loop.
  const listIsDraft = purchaseList?.status === "draft";
  useEffect(() => {
    if (tab === "purchase" && listIsDraft) {
      router.replace(newPurchaseListHref);
    }
  }, [tab, listIsDraft, newPurchaseListHref, router]);

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerIdParam && producer
      ? [{ label: producer.name, href: `/producers/${producerIdParam}` }]
      : []),
    ...(farm ? [{ label: farm.name, href: farmHref }] : []),
    { label: cycle?.name ?? "Safra" },
  ];

  if (isLoading || !cycle) {
    return (
      <>
        <BreadcrumbBack items={breadcrumbs} />
        <ListCardsSkeleton count={3} />
      </>
    );
  }

  if (wizardOpen) {
    return (
      <>
        <BreadcrumbBack
          items={[...breadcrumbs.slice(0, -1), { label: cycle.name }]}
        />
        <CycleBlockWizard
          cycle={cycle}
          producerId={producerId}
          onDone={() => setWizardOpen(false)}
          onCancel={() => setWizardOpen(false)}
        />
      </>
    );
  }

  const isPlanning = seasons.length === 0;

  const heroStats: PageHeroStat[] = [
    {
      label: "Culturas",
      value: cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + "),
    },
    ...(farm?.name ? [{ label: "Fazenda", value: farm.name }] : []),
    ...(tab === "recommendations"
      ? [
          { label: "Talhões", value: plotCount },
          { label: "Área", value: `${fmtHa(totalArea)} ha` },
          {
            label: "Aplicações",
            value: totalRecs > 0 ? `${doneRecs}/${totalRecs}` : "—",
            sub: totalRecs > 0 ? `${progressPct}%` : undefined,
          },
          {
            label: purchaseList?.name ?? "Lista de compra",
            value: purchaseList ? (purchaseList.items ?? []).length : 0,
            sub: "produtos",
            onClick: () => setTab("purchase"),
          },
        ]
      : []),
  ];

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        variant="inverted"
        icon={<Leaf className="size-6" />}
        eyebrow="Safra"
        title={cycle.name}
        titleBadge={
          isPlanning ? (
            <Badge variant="neutral">Em planejamento</Badge>
          ) : (
            <Badge variant={cycle.status === "ACTIVE" ? "success" : "neutral"}>
              {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
            </Badge>
          )
        }
        actions={
          <>
            {/* Enquanto houver talhão em rascunho, publicar fica visível em TODAS
                as abas — sem isso a programação não aparece no cronograma e o
                botão passava despercebido. */}
            {draftSeasons.length > 0 ? (
              <Button
                className="gap-1.5"
                onClick={() => setPublishConfirm(true)}
                disabled={publishCycle.isPending}
              >
                <Rocket className="size-4" />
                {publishCycle.isPending
                  ? "Publicando..."
                  : "Revisar e publicar"}
              </Button>
            ) : null}
            {tab === "recommendations" ? (
              <>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setTab("cost-plan")}
                >
                  <Calculator className="size-4" />
                  Plano de custo
                </Button>
                <Button
                  variant="clay"
                  className="gap-1.5"
                  onClick={() => setTab("purchase")}
                >
                  <ShoppingCart className="size-4" />
                  Lista de compra
                </Button>
              </>
            ) : null}
          </>
        }
        stats={heroStats}
      />

      {/* Nas sub-abas (lista de compra / plano de custo) mostramos só voltar.
          Estoque fica na barra de ações da lista de compra (FarmPurchaseListTab). */}
      {tab !== "recommendations" ? (
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setTab("recommendations")}
          >
            <ArrowLeft className="size-4" />
            Voltar à safra
          </Button>
        </div>
      ) : null}

      {tab === "purchase" ? (
        !purchaseList && !loadingList ? (
          <EmptyState
            icon={ShoppingCart}
            title="Esta safra ainda não tem lista de compra."
            description="Monte a lista com tudo que a safra vai precisar — soja e milho juntos — e entregue ao produtor antes mesmo de montar a programação."
            action={
              canListCrud ? (
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={newPurchaseListHref}>
                    <Plus className="size-4" />
                    Montar lista de compra
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : listIsDraft ? (
          // Rascunho em andamento: o efeito acima já redireciona para o wizard
          // (continua o fluxo). Este é só o estado enquanto o redirect acontece.
          <EmptyState
            icon={ShoppingCart}
            title="Retomando o rascunho da lista…"
            description="Abrindo a lista de compra de onde você parou."
            action={
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={newPurchaseListHref}>
                  <ShoppingCart className="size-4" />
                  Continuar rascunho
                </Link>
              </Button>
            }
          />
        ) : (
          <FarmPurchaseListTab
            farmId={farmId}
            list={purchaseList ?? null}
            purchaseLists={purchaseList ? [purchaseList] : []}
            selectedListId={purchaseList?.id ?? ""}
            onSelectList={() => {}}
            isLoading={loadingList}
            producerId={producerId || null}
            newPurchaseListHref={newPurchaseListHref}
            fallbackSeasonIds={[]}
            onOpenCostPlan={() => setTab("cost-plan")}
            stockHref={stockHref}
          />
        )
      ) : tab === "cost-plan" ? (
        <CycleCostPlanView
          cycleId={cycleId}
          producerName={producer?.name}
          farmName={farm?.name}
          onOpenPurchaseList={() => setTab("purchase")}
        />
      ) : (
        <div className="space-y-4">
          {!isPlanning ? (
            <SectionToolbar
              title="Talhões desta safra"
              search={{
                value: plotFilter,
                onChange: setPlotFilter,
                placeholder: "Filtrar talhão…",
              }}
              actions={
                <Button
                  className="hidden gap-1.5 sm:inline-flex"
                  onClick={() => setWizardOpen(true)}
                >
                  <Plus className="size-4" />
                  Adicionar talhão
                </Button>
              }
            />
          ) : null}

          {isPlanning ? (
            <EmptyState
              icon={Leaf}
              title="Programação ainda não montada."
              description="Adicione os talhões escolhendo um modelo de recomendação — você pode aplicar modelos diferentes a grupos de talhões diferentes antes de publicar."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!purchaseList && canListCrud ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                    >
                      <Link href={newPurchaseListHref}>
                        <ShoppingCart className="size-4" />
                        Montar lista de compra
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setWizardOpen(true)}
                  >
                    <Plus className="size-4" />
                    Adicionar talhão
                  </Button>
                </div>
              }
            />
          ) : filteredSeasons.length === 0 ? (
            <EmptyState
              variant="inline"
              title="Nenhum talhão encontrado."
              description={`Não há talhões com o nome "${plotFilter.trim()}".`}
            />
          ) : (
            <>
              {/* Desktop: tabela de talhões da safra */}
              <div className="hidden overflow-hidden border shadow-sm rounded-xl border-border bg-card md:block">
                <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 bg-surface-2 px-5 py-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <span>Talhão</span>
                  <span>Cultura / variedade</span>
                  <span>Área</span>
                  <span>Progresso</span>
                  <span>Status</span>
                  <span className="text-right">Ações</span>
                </div>
                {filteredSeasons.map((season) => {
                  const row = seasonRowData(season, farmId, producerId);
                  return (
                    <div
                      key={season.id}
                      className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1fr)_14.5rem] items-center gap-4 border-t border-border px-5 py-3.5 text-sm"
                    >
                      <span className="font-semibold truncate text-text-strong">
                        Talhão {season.plot_name}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-muted-foreground">
                          {row.displayName}
                        </span>
                        {row.varietiesBreakdown ? (
                          <span className="block text-xs truncate text-muted-foreground/80">
                            {row.varietiesBreakdown}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums">
                        {fmtHa(row.area)} ha
                        {row.partialArea ? (
                          <span className="block text-xs text-muted-foreground">
                            de {fmtHa(season.plot_area_ha)} ha
                          </span>
                        ) : null}
                      </span>
                      <span>
                        {season.recommendations_total > 0 ? (
                          <span className="flex items-center gap-2">
                            <ProgressBar
                              value={row.pct}
                              className="h-1.5 flex-1 bg-surface-2"
                            />
                            <span className="text-xs font-semibold shrink-0 tabular-nums text-primary-strong">
                              {row.pct}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </span>
                      <span>
                        <Badge
                          variant={STATUS_VARIANTS[season.status] ?? "default"}
                        >
                          {STATUS_LABELS[season.status] ?? season.status}
                        </Badge>
                      </span>
                      <span className="flex justify-end gap-4">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={row.recommendationHref}>
                            Recomendações
                            <ChevronRight />
                          </Link>
                        </Button>
                        {season.status !== "ARCHIVED" ? (
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() =>
                              setArchiveConfirm({
                                id: season.id,
                                name: `${season.plot_name} — ${row.displayName}`,
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mobile: cards */}
              <div className="flex flex-col gap-2.5 md:hidden">
                {filteredSeasons.map((season) => {
                  const row = seasonRowData(season, farmId, producerId);
                  return (
                    <div
                      key={season.id}
                      className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-text-strong">
                            Talhão {season.plot_name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {row.displayName} · {fmtHa(row.area)}
                            {row.partialArea
                              ? ` de ${fmtHa(season.plot_area_ha)}`
                              : ""}{" "}
                            ha
                          </p>
                        </div>
                        <Badge
                          className="shrink-0"
                          variant={STATUS_VARIANTS[season.status] ?? "default"}
                        >
                          {STATUS_LABELS[season.status] ?? season.status}
                        </Badge>
                      </div>
                      {season.recommendations_total > 0 ? (
                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {season.recommendations_done}/
                              {season.recommendations_total} aplicadas
                            </span>
                            <span className="font-semibold tabular-nums text-primary-strong">
                              {row.pct}%
                            </span>
                          </div>
                          <ProgressBar value={row.pct} className="h-1.5" />
                        </div>
                      ) : null}
                      <div className="flex gap-2 mt-3">
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                        >
                          <Link href={row.recommendationHref}>
                            <SquareCheckBig />
                            Recomendações
                          </Link>
                        </Button>
                        {season.status !== "ARCHIVED" ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              setArchiveConfirm({
                                id: season.id,
                                name: `${season.plot_name} — ${row.displayName}`,
                              })
                            }
                          >
                            <Trash2 />
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {!isPlanning ? (
            <StickyMobileCta>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="size-4" />
                Adicionar talhão
              </Button>
            </StickyMobileCta>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={publishConfirm}
        onOpenChange={setPublishConfirm}
        title="Publicar programação da safra"
        description={`${draftSeasons.length} ${
          draftSeasons.length === 1
            ? "talhão em rascunho será publicado"
            : "talhões em rascunho serão publicados"
        } e o produtor passa a ver o cronograma. Continuar?`}
        confirmLabel="Publicar"
        loading={publishCycle.isPending}
        onConfirm={async () => {
          await new Promise<void>((resolve, reject) =>
            publishCycle.mutate(undefined, {
              onSuccess: () => {
                setPublishConfirm(false);
                toast.success("Programação da safra publicada!");
                resolve();
              },
              onError: (err) => {
                toast.error(
                  "Não foi possível publicar. Verifique a quota do plano.",
                );
                reject(err);
              },
            }),
          );
        }}
      />

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Remover talhão da safra"
        description={
          archiveConfirm
            ? `A programação de "${archiveConfirm.name}" será movida para Removidas.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={archiveSeason.isPending}
        onConfirm={async () => {
          if (!archiveConfirm) return;
          await new Promise<void>((resolve, reject) =>
            archiveSeason.mutate(archiveConfirm.id, {
              onSuccess: () => {
                setArchiveConfirm(null);
                toast.success("Talhão removido da safra.");
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />
    </>
  );
}

/** Dados derivados de uma linha de talhão (tabela desktop e card mobile). */
function seasonRowData(
  season: CycleSeasonRow,
  farmId: string,
  producerId: string,
) {
  const recommendationHref = `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}${
    producerId ? `&producer_id=${encodeURIComponent(producerId)}` : ""
  }`;
  const pct =
    season.recommendations_total > 0
      ? Math.round(
          (season.recommendations_done / season.recommendations_total) * 100,
        )
      : 0;
  const seasonVarieties = season.varieties ?? [];
  const varietiesBreakdown =
    seasonVarieties.length > 1
      ? seasonVarieties
          .map(
            (v) =>
              `${v.variety}${
                v.planted_area_ha != null
                  ? ` (${fmtHa(v.planted_area_ha)} ha)`
                  : ""
              }`,
          )
          .join(" · ")
      : null;
  const partialArea =
    season.planted_area_ha != null &&
    season.planted_area_ha !== season.plot_area_ha;
  return {
    recommendationHref,
    pct,
    displayName: seasonDisplayName(season),
    varietiesBreakdown,
    partialArea,
    area: season.planted_area_ha ?? season.plot_area_ha,
  };
}
