"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  CalendarDays,
  Leaf,
  ListChecks,
  MapPin,
  Plus,
  Rocket,
  Search,
  ShoppingCart,
  Sprout,
} from "lucide-react";
import { toast } from "sonner";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { CycleBlockWizard } from "@/components/domain/cycle-block-wizard";
import { CycleCostPlanView } from "@/components/domain/cycle-cost-plan-view";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import {
  useArchiveSeason,
  useCycle,
  useCyclePurchaseList,
  useFarm,
  useMe,
  useProducer,
  usePublishCycle,
} from "@/lib/api/hooks";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";

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

export default function CycleDetailPage() {
  const params = useParams<{ id: string; cycleId: string }>();
  const farmId = params.id;
  const cycleId = params.cycleId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const producerIdParam = searchParams.get("producer_id");
  const tab = parseCycleTab(searchParams.get("tab"));

  const { data: cycle, isLoading } = useCycle(cycleId);
  const { data: farm } = useFarm(farmId);
  const { data: me } = useMe();
  const producerId = producerIdParam ?? cycle?.producer_id ?? "";
  const { data: producer } = useProducer(producerId);
  const { data: purchaseList, isLoading: loadingList } = useCyclePurchaseList(cycleId);
  const publishCycle = usePublishCycle(cycleId);
  const archiveSeason = useArchiveSeason();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
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
  const totalRecs = seasons.reduce((s, row) => s + row.recommendations_total, 0);
  const doneRecs = seasons.reduce((s, row) => s + row.recommendations_done, 0);
  const progressPct = totalRecs > 0 ? Math.round((doneRecs / totalRecs) * 100) : 0;
  const areaByPlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of seasons) {
      map.set(s.plot_id, s.planted_area_ha ?? s.plot_area_ha);
    }
    return map;
  }, [seasons]);
  const totalArea = [...areaByPlot.values()].reduce((s, v) => s + v, 0);
  // Conta as programações realmente listadas (uma por card). areaByPlot deduplica
  // por plot_id — quando o mesmo talhão tem duas culturas/ciclos na safra ele
  // aparece em dois cards, então o contador precisa bater com o que está na tela
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
        <BreadcrumbBack items={[...breadcrumbs.slice(0, -1), { label: cycle.name }]} />
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

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <section className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
            <Leaf className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-text-strong">
                {cycle.name}
              </h1>
              {isPlanning ? (
                <Badge variant="neutral">Em planejamento</Badge>
              ) : (
                <Badge variant={cycle.status === "HARVESTED" ? "success" : "info"}>
                  {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                cycle.crops.map((c) => CROP_LABELS[c] ?? c).join(" + "),
                farm?.name,
                isPlanning
                  ? "sem talhões programados"
                  : `${plotCount} ${plotCount === 1 ? "talhão" : "talhões"} · ${fmtHa(totalArea)} ha`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        {/* Ações de programação (adicionar talhão / publicar) vivem só na aba
            Recomendações — publicar = finalizar a programação, não faz sentido
            repetir sobre a lista de compra ou o plano de custo. */}
        {tab === "recommendations" ? (
          <div className="flex flex-wrap gap-2">
            {draftSeasons.length > 0 ? (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setPublishConfirm(true)}
                disabled={publishCycle.isPending}
              >
                <Rocket className="size-4" />
                {publishCycle.isPending ? "Publicando..." : "Revisar e publicar"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setTab("purchase")}
            >
              <ShoppingCart className="size-4" />
              Lista de compra
            </Button>
            <Button className="gap-1.5" onClick={() => setWizardOpen(true)}>
              <Plus className="size-4" />
              Adicionar talhão
            </Button>
          </div>
        ) : null}
      </section>

      {/* Resumo da safra: contexto da programação, então só na aba Recomendações.
          Nas abas Lista de compra / Plano de custo cada uma já traz seus próprios
          números, e empilhar as duas faixas deixava a tela pesada. */}
      {tab === "recommendations" ? (
        <KpiStrip className="mb-6">
          <KpiCell
            label="Talhões na safra"
            value={plotCount}
            icon={<MapPin className="size-4" />}
          />
          <KpiCell
            label="Área"
            value={`${fmtHa(totalArea)} ha`}
            icon={<Sprout className="size-4" />}
          />
          <KpiCell
            label="Aplicações"
            value={totalRecs > 0 ? `${doneRecs}/${totalRecs}` : "—"}
            sub={totalRecs > 0 ? `${progressPct}%` : undefined}
            icon={<CalendarDays className="size-4" />}
          />
          <KpiCell
            label={purchaseList?.name ?? "Lista de compra"}
            value={purchaseList ? (purchaseList.items ?? []).length : 0}
            sub="produtos"
            icon={<ShoppingCart className="size-4" />}
            onClick={() => setTab("purchase")}
          />
        </KpiStrip>
      ) : null}

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
              <Button asChild size="sm" className="gap-1.5">
                <Link href={newPurchaseListHref}>
                  <Plus className="size-4" />
                  Montar lista de compra
                </Link>
              </Button>
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
        <div className="space-y-6">
          {!isPlanning ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                {cycle.blocks.map((block) => (
                  <span
                    key={block.timing_template_id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    <ListChecks className="size-3.5 text-primary-strong" />
                    {block.template_name}
                    <span className="text-muted-foreground">
                      → {block.plots_count}{" "}
                      {block.plots_count === 1 ? "talhão" : "talhões"}
                    </span>
                  </span>
                ))}
              </div>
              <div className="relative ml-auto w-full min-w-48 max-w-xs sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={plotFilter}
                  onChange={(e) => setPlotFilter(e.target.value)}
                  placeholder="Filtrar talhão..."
                  className="h-9 pl-8"
                />
              </div>
            </div>
          ) : null}

          {isPlanning ? (
            <EmptyState
              icon={Leaf}
              title="Programação ainda não montada."
              description="Adicione os talhões escolhendo um modelo de recomendação — você pode aplicar modelos diferentes a grupos de talhões diferentes antes de publicar."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {!purchaseList ? (
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link href={newPurchaseListHref}>
                        <ShoppingCart className="size-4" />
                        Montar lista de compra
                      </Link>
                    </Button>
                  ) : null}
                  <Button size="sm" className="gap-1.5" onClick={() => setWizardOpen(true)}>
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
            <div className="max-h-[min(60vh,720px)] space-y-4 overflow-y-auto pr-1">
              {filteredSeasons.map((season) => {
                const recommendationHref = `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}${
                  producerId ? `&producer_id=${encodeURIComponent(producerId)}` : ""
                }`;
                const costPlanHref = `/seasons/${season.id}?tab=cost-plan&farm_id=${encodeURIComponent(farmId)}${
                  producerId ? `&producer_id=${encodeURIComponent(producerId)}` : ""
                }`;
                const pct =
                  season.recommendations_total > 0
                    ? Math.round(
                        (season.recommendations_done / season.recommendations_total) * 100,
                      )
                    : 0;
                const displayName = `${CROP_LABELS[season.crop] ?? season.crop}${
                  season.variety ? ` — ${season.variety}` : ""
                }`;
                return (
                  <Card key={season.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-3 px-4 py-4">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                          <MapPin className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-semibold text-foreground">
                              Talhão {season.plot_name}
                            </p>
                            <Badge
                              className="shrink-0"
                              variant={STATUS_VARIANTS[season.status] ?? "default"}
                            >
                              {STATUS_LABELS[season.status] ?? season.status}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {displayName}
                            {season.planted_area_ha != null &&
                            season.planted_area_ha !== season.plot_area_ha
                              ? ` · ${fmtHa(season.planted_area_ha)} de ${fmtHa(season.plot_area_ha)} ha plantados`
                              : ` · ${fmtHa(season.plot_area_ha)} ha`}
                          </p>
                        </div>
                      </div>

                      {season.recommendations_total > 0 ? (
                        <div className="border-t border-border bg-rail px-4 py-3">
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">
                              {season.recommendations_done}/{season.recommendations_total}{" "}
                              aplicadas
                            </span>
                            <span className="font-semibold tabular-nums text-primary-strong">
                              {pct}%
                            </span>
                          </div>
                          <ProgressBar value={pct} />
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <Link href={recommendationHref}>
                            <CalendarDays className="size-3.5" />
                            Ver Recomendação
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <Link href={costPlanHref}>
                            <Calculator className="size-3.5" />
                            Plano de custo
                          </Link>
                        </Button>
                        {season.status !== "ARCHIVED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "ml-auto text-muted-foreground",
                              deactivateOutlineButtonClass,
                            )}
                            onClick={() =>
                              setArchiveConfirm({
                                id: season.id,
                                name: `${season.plot_name} — ${displayName}`,
                              })
                            }
                          >
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
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
                toast.error("Não foi possível publicar. Verifique a quota do plano.");
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
