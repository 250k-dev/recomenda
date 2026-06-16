"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { KpiStrip, KpiCell } from "@/components/domain/kpi-strip";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useCreatePlot,
  useDeletePlot,
  useFarm,
  useFarmAccess,
  useFarmPlots,
  useFarmPurchaseLists,
  useFarmSeasons,
  useGrantFarmAccess,
  useProducer,
  useProducerPurchaseLists,
  useProducers,
  useRevokeFarmAccess,
  useUpdateFarm,
  useArchiveSeason,
  queryKeys,
} from "@/lib/api/hooks";
import { getTimeline, type Recommendation } from "@/lib/api/seasons";
import { FarmPurchaseListTab } from "@/components/domain/farm-purchase-list-tab";
import { FarmPurchaseListSummaryPanel } from "@/components/domain/farm-purchase-list-summary-panel";
import type { PurchaseListDetail } from "@/lib/api/client";
import { activeAgronomistProducerAccounts } from "@/lib/api/client";
import { toast } from "sonner";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";
import { deactivateOutlineButtonClass } from "@/lib/action-button-styles";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Eye,
  Plus,
  Pencil,
  Sprout,
  MapPin,
  Trash2,
  Users as UsersIcon,
  UserPlus,
  X,
  Leaf,
  ShoppingCart,
  CalendarDays,
  Calculator,
} from "lucide-react";

const SEASON_PRIORITY: Record<string, number> = {
  IN_PROGRESS: 0,
  PUBLISHED: 1,
  DRAFT: 2,
  HARVESTED: 3,
  ARCHIVED: 4,
};

const ACTIVE_SEASON_STATUSES = new Set(["DRAFT", "PUBLISHED", "IN_PROGRESS"]);

const farmSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  location: z.string().optional(),
});

const plotSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  area_hectares: z.number().positive("Área deve ser maior que zero"),
});

type FarmFormValues = z.infer<typeof farmSchema>;
type PlotFormValues = z.infer<typeof plotSchema>;

type FarmViewTab = "seasons" | "purchase" | "plots";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function seasonProgressFromTimeline(rows: Recommendation[] | undefined): {
  done: number;
  total: number;
  pct: number;
} | null {
  if (!rows?.length) return null;
  const done = rows.filter(
    (rec) => rec.status === "APPLIED_ON_TIME" || rec.status === "APPLIED_LATE",
  ).length;
  return {
    done,
    total: rows.length,
    pct: Math.round((done / rows.length) * 100),
  };
}

function parseFarmViewTab(value: string | null): FarmViewTab {
  if (value === "purchase" || value === "plots" || value === "seasons") return value;
  return "seasons";
}

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");
  const tabFromUrl = parseFarmViewTab(searchParams.get("tab"));

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: access, isLoading: loadingAccess } = useFarmAccess(farmId);

  const resolvedProducerId = useMemo(() => {
    if (producerId) return producerId;
    if (access?.length === 1) return access[0].producer_id;
    return null;
  }, [producerId, access]);
  const updateFarm = useUpdateFarm(farmId);
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: seasons, isLoading: loadingSeasons } = useFarmSeasons(farmId);
  const { data: producersData } = useProducers();

  const createPlot = useCreatePlot(farmId);
  const deletePlot = useDeletePlot(farmId);
  const grantAccess = useGrantFarmAccess(farmId);
  const revokeAccess = useRevokeFarmAccess(farmId);

  const [editOpen, setEditOpen] = useState(false);
  const [plotSheetOpen, setPlotSheetOpen] = useState(false);
  const [accessSheetOpen, setAccessSheetOpen] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState("");
  const [deletePlotConfirm, setDeletePlotConfirm] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [revokeAccessConfirm, setRevokeAccessConfirm] = useState<
    { producerId: string; name: string } | null
  >(null);
  const setFarmViewWithUrl = useCallback(
    (tab: FarmViewTab) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const { data: farmPurchaseLists, isLoading: loadingFarmPurchaseLists } =
    useFarmPurchaseLists(farmId);
  const { data: producerPurchaseLists, isLoading: loadingProducerPurchaseLists } =
    useProducerPurchaseLists(resolvedProducerId ?? "");

  const loadingPurchaseLists =
    loadingFarmPurchaseLists ||
    loadingProducerPurchaseLists ||
    loadingPlots ||
    (Boolean(resolvedProducerId) && loadingAccess);

  const farmForm = useForm<FarmFormValues>({
    resolver: zodResolver(farmSchema),
    values: {
      name: farm?.name ?? "",
      location: farm?.location ?? "",
    },
  });

  const onUpdateFarm = farmForm.handleSubmit((values) => {
    updateFarm.mutate(values, {
      onSuccess: () => {
        toast.success("Fazenda atualizada com sucesso!");
        setEditOpen(false);
      },
      onError: () => toast.error("Erro ao atualizar fazenda"),
    });
  });

  const plotForm = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: { name: "", area_hectares: 0 },
  });

  const onAddPlot = plotForm.handleSubmit((values) => {
    createPlot.mutate(values, {
      onSuccess: () => {
        setPlotSheetOpen(false);
        plotForm.reset();
        toast.success("Talhão adicionado!");
      },
    });
  });

  const producersList = producersData?.data ?? [];
  const grantableProducers = activeAgronomistProducerAccounts(producersList);
  const grantedIds = new Set(access?.map((a) => a.producer_id) ?? []);
  const availableProducers = grantableProducers.filter(
    (p) => !grantedIds.has(p.producer_id),
  );
  const producerMap = new Map(
    grantableProducers.map((p) => [p.producer_id, p]),
  );

  const plotIds = useMemo(
    () => new Set((plots ?? []).map((p) => p.id)),
    [plots],
  );

  const farmPurchaseListsResolved = useMemo(() => {
    if (farmPurchaseLists?.length) return farmPurchaseLists;
    if (!producerPurchaseLists?.length) return [];
    return producerPurchaseLists.filter((list) =>
      (list.plots ?? []).some((lp) => plotIds.has(lp.plot_id)),
    );
  }, [farmPurchaseLists, producerPurchaseLists, plotIds]);

  const latestPurchaseList = useMemo(() => {
    const sorted = [...farmPurchaseListsResolved].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    return sorted[0] ?? null;
  }, [farmPurchaseListsResolved]);

  const sortedPurchaseLists = useMemo(
    () =>
      [...farmPurchaseListsResolved].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [farmPurchaseListsResolved],
  );

  const [selectedListId, setSelectedListId] = useState<string>("");
  const [plotsPanelOpen, setPlotsPanelOpen] = useState(false);

  const effectiveSelectedListId = useMemo(() => {
    if (sortedPurchaseLists.length === 0) return "";
    if (sortedPurchaseLists.some((list) => list.id === selectedListId)) {
      return selectedListId;
    }
    return sortedPurchaseLists[0].id;
  }, [sortedPurchaseLists, selectedListId]);

  const selectedList = useMemo(
    () =>
      farmPurchaseListsResolved.find((list) => list.id === effectiveSelectedListId) ??
      latestPurchaseList,
    [farmPurchaseListsResolved, effectiveSelectedListId, latestPurchaseList],
  );

  const activeSeasonIds = useMemo(
    () =>
      (seasons ?? [])
        .filter((s) => ACTIVE_SEASON_STATUSES.has(s.status))
        .map((s) => s.id),
    [seasons],
  );

  const sortedPlots = useMemo(() => {
    if (!plots) return [];
    return [...plots].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [plots]);

  /** Mapa plot_id -> safra ativa (a 1ª pela prioridade de status) para mostrar
   *  no card do talhão o que está sendo plantado. */
  const seasonByPlot = useMemo(() => {
    const map = new Map<string, { crop: string; variety: string | null; status: string }>();
    for (const s of seasons ?? []) {
      if (!s.plot_id) continue;
      const existing = map.get(s.plot_id);
      if (!existing) {
        map.set(s.plot_id, { crop: s.crop, variety: s.variety ?? null, status: s.status });
        continue;
      }
      const isBetter =
        (SEASON_PRIORITY[s.status] ?? 99) < (SEASON_PRIORITY[existing.status] ?? 99);
      if (isBetter) {
        map.set(s.plot_id, { crop: s.crop, variety: s.variety ?? null, status: s.status });
      }
    }
    return map;
  }, [seasons]);

  const sortedSeasons = useMemo(() => {
    if (!seasons) return [];
    return [...seasons].sort((a, b) => {
      const byStatus =
        (SEASON_PRIORITY[a.status] ?? 99) - (SEASON_PRIORITY[b.status] ?? 99);
      if (byStatus !== 0) return byStatus;
      return a.plot_name.localeCompare(b.plot_name, "pt-BR");
    });
  }, [seasons]);

  const totalHectares = useMemo(
    () =>
      (plots ?? []).reduce(
        (acc, p) => acc + (Number(p.area_hectares) || 0),
        0,
      ),
    [plots],
  );

  const activeSeasonsCount = useMemo(
    () => (seasons ?? []).filter((s) => ACTIVE_SEASON_STATUSES.has(s.status)).length,
    [seasons],
  );

  const purchaseListBySeasonId = useMemo(() => {
    const map = new Map<string, PurchaseListDetail>();
    for (const list of farmPurchaseListsResolved) {
      if (list.season_id) map.set(list.season_id, list);
    }
    return map;
  }, [farmPurchaseListsResolved]);

  const openPlotsPanel = useCallback(() => {
    setPlotsPanelOpen(true);
    setFarmViewWithUrl("plots");
  }, [setFarmViewWithUrl]);

  const openPurchaseView = useCallback(
    (listId?: string) => {
      if (listId) setSelectedListId(listId);
      setFarmViewWithUrl("purchase");
    },
    [setFarmViewWithUrl],
  );

  const openPurchaseForSeason = useCallback(
    (seasonId: string) => {
      const list = purchaseListBySeasonId.get(seasonId);
      openPurchaseView(list?.id);
    },
    [purchaseListBySeasonId, openPurchaseView],
  );

  const summaryCostPlanHref = useMemo(() => {
    const seasonId =
      selectedList?.season_id ??
      sortedSeasons.find((season) => ACTIVE_SEASON_STATUSES.has(season.status))?.id;
    if (!seasonId) return null;
    return resolvedProducerId
      ? `/seasons/${seasonId}?tab=cost-plan&farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(resolvedProducerId)}`
      : `/seasons/${seasonId}?tab=cost-plan&farm_id=${encodeURIComponent(farmId)}`;
  }, [selectedList?.season_id, sortedSeasons, farmId, resolvedProducerId]);

  const handlePlotsPanelChange = useCallback(
    (open: boolean) => {
      setPlotsPanelOpen(open);
      if (!open && tabFromUrl === "plots") {
        const next = new URLSearchParams(searchParams.toString());
        next.set("tab", "seasons");
        router.replace(`?${next.toString()}`, { scroll: false });
      }
    },
    [router, searchParams, tabFromUrl],
  );

  useEffect(() => {
    if (tabFromUrl === "plots") setPlotsPanelOpen(true);
  }, [tabFromUrl]);

  const breadcrumbs = [
    { label: "Produtores", href: "/producers" },
    ...(producerId && producer
      ? [{ label: producer.name, href: `/producers/${producerId}` }]
      : []),
    { label: farm?.name ?? "Fazenda" },
  ];

  const newSeasonHref = resolvedProducerId
    ? `/farms/${farmId}/season/new?producer_id=${encodeURIComponent(resolvedProducerId)}`
    : `/farms/${farmId}/season/new`;

  const newPurchaseListHref = resolvedProducerId
    ? `/farms/${farmId}/purchase-list/new?producer_id=${encodeURIComponent(resolvedProducerId)}`
    : `/farms/${farmId}/purchase-list/new`;

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <section className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-text-strong">
            {farm?.name ?? "Detalhes da fazenda"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              farm?.location?.trim(),
              `${plots?.length ?? 0} ${(plots?.length ?? 0) === 1 ? "talhão" : "talhões"}`,
              `${fmtHa(totalHectares)} ha`,
            ]
              .filter(Boolean)
              .join(" · ") || "Sem localização cadastrada"}
          </p>
        </div>
        <Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Editar fazenda</SheetTitle>
            </SheetHeader>
            <form onSubmit={onUpdateFarm} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Nome
                </label>
                <Input
                  {...farmForm.register("name")}
                  placeholder="Nome da fazenda"
                />
                {farmForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-destructive">
                    {farmForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Endereço
                </label>
                <Input
                  {...farmForm.register("location")}
                  placeholder="Ex: Município, Estado"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={updateFarm.isPending}
                  className="flex-1"
                >
                  {updateFarm.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </SheetContent>
        </Sheet>
      </section>

      {tabFromUrl !== "purchase" ? (
        <KpiStrip className="mb-8">
          <KpiCell
            label="Talhões"
            value={plots?.length ?? 0}
            icon={<MapPin className="size-4" />}
            onClick={openPlotsPanel}
          />
          <KpiCell
            label="Área total"
            value={`${fmtHa(totalHectares)} ha`}
            icon={<Sprout className="size-4" />}
          />
          <KpiCell
            label="Safras ativas"
            value={activeSeasonsCount}
            icon={<Leaf className="size-4" />}
          />
          <KpiCell
            label={selectedList?.name ?? "Lista de compra"}
            value={selectedList ? (selectedList.items ?? []).length : 0}
            sub="produtos"
            icon={<ShoppingCart className="size-4" />}
            onClick={() => openPurchaseView()}
          />
        </KpiStrip>
      ) : null}

      {tabFromUrl === "purchase" ? (
        <section>
          <div className="mb-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setFarmViewWithUrl("seasons")}
            >
              ← Voltar às safras
            </Button>
          </div>
          <FarmPurchaseListTab
            farmId={farmId}
            list={selectedList}
            purchaseLists={sortedPurchaseLists}
            selectedListId={effectiveSelectedListId}
            onSelectList={setSelectedListId}
            isLoading={loadingPurchaseLists}
            producerId={resolvedProducerId}
            newPurchaseListHref={newPurchaseListHref}
            fallbackSeasonIds={activeSeasonIds}
          />
        </section>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <section>
            <FarmSeasonsTab
              seasons={sortedSeasons}
              isLoading={loadingSeasons}
              farmId={farmId}
              producerId={resolvedProducerId}
              newSeasonHref={newSeasonHref}
              onOpenPurchaseList={openPurchaseForSeason}
            />
          </section>

          <aside className="min-w-0 xl:sticky xl:top-24">
            <FarmPurchaseListSummaryPanel
              list={selectedList}
              isLoading={loadingPurchaseLists}
              producerName={producer?.name}
              onOpenFull={() => openPurchaseView()}
              costPlanHref={summaryCostPlanHref}
            />
          </aside>
        </div>
      )}

      <Sheet open={plotsPanelOpen} onOpenChange={handlePlotsPanelChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Talhões</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <div className="mb-4 flex items-center justify-end">
              <Sheet open={plotSheetOpen} onOpenChange={setPlotSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Adicionar talhão
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Novo talhão</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={onAddPlot} className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground">
                        Nome
                      </label>
                      <Input
                        {...plotForm.register("name")}
                        placeholder="Ex: Talhão 1"
                      />
                      {plotForm.formState.errors.name && (
                        <p className="mt-1 text-xs text-destructive">
                          {plotForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground">
                        Área (hectares)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        {...plotForm.register("area_hectares", {
                          valueAsNumber: true,
                        })}
                        placeholder="0.00"
                      />
                      {plotForm.formState.errors.area_hectares && (
                        <p className="mt-1 text-xs text-destructive">
                          {plotForm.formState.errors.area_hectares.message}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        disabled={createPlot.isPending}
                        className="flex-1"
                      >
                        {createPlot.isPending ? "Adicionando..." : "Adicionar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPlotSheetOpen(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </SheetContent>
              </Sheet>
            </div>

            {loadingPlots ? (
              <ListCardsSkeleton count={4} />
            ) : sortedPlots.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum talhão cadastrado"
                description="Cadastre talhões para começar a planejar safras."
                action={
                  <Button size="sm" className="gap-1.5" onClick={() => setPlotSheetOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Adicionar primeiro talhão
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {sortedPlots.map((plot) => {
                  const plotHref = producerId
                    ? `/farms/${farmId}/plots/${plot.id}?producer_id=${encodeURIComponent(producerId)}`
                    : `/farms/${farmId}/plots/${plot.id}`;

                  const season = seasonByPlot.get(plot.id);
                  return (
                    <Card key={plot.id} className="overflow-hidden">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-foreground">
                            {plot.name}
                          </h3>
                          {season ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-strong">
                              <Sprout className="h-3 w-3" />
                              {CROP_LABELS[season.crop] ?? season.crop}
                              {season.variety ? ` · ${season.variety}` : ""}
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                              sem safra
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                            {Number(plot.area_hectares).toFixed(2)} ha
                          </span>
                        </div>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          title="Ver detalhes do talhão"
                          className="gap-1.5 text-muted-foreground hover:text-primary"
                        >
                          <Link href={plotHref} aria-label={`Ver talhão ${plot.name}`}>
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Ver</span>
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remover talhão"
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                          disabled={deletePlot.isPending}
                          onClick={() =>
                            setDeletePlotConfirm({ id: plot.id, name: plot.name })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Remover</span>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deletePlotConfirm}
        onOpenChange={(open) => !open && setDeletePlotConfirm(null)}
        title="Remover talhão"
        description={
          deletePlotConfirm
            ? `Remover o talhão "${deletePlotConfirm.name}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={deletePlot.isPending}
        onConfirm={async () => {
          if (!deletePlotConfirm) return;
          await new Promise<void>((resolve, reject) =>
            deletePlot.mutate(deletePlotConfirm.id, {
              onSuccess: () => {
                setDeletePlotConfirm(null);
                resolve();
              },
              onError: (err) => reject(err),
            }),
          );
        }}
      />

      <ConfirmDialog
        open={!!revokeAccessConfirm}
        onOpenChange={(open) => !open && setRevokeAccessConfirm(null)}
        title="Revogar acesso"
        description={
          revokeAccessConfirm
            ? `Revogar acesso de "${revokeAccessConfirm.name}" a esta fazenda?`
            : undefined
        }
        confirmLabel="Revogar"
        tone="destructive"
        loading={revokeAccess.isPending}
        onConfirm={async () => {
          if (!revokeAccessConfirm) return;
          await new Promise<void>((resolve, reject) =>
            revokeAccess.mutate(revokeAccessConfirm.producerId, {
              onSuccess: () => {
                setRevokeAccessConfirm(null);
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

function FarmSeasonsTab({
  seasons,
  isLoading,
  farmId,
  producerId,
  newSeasonHref,
  onOpenPurchaseList,
}: {
  seasons: Array<{
    id: string;
    plot_name: string;
    crop: string;
    variety?: string | null;
    status: string;
  }>;
  isLoading: boolean;
  farmId: string;
  producerId: string | null;
  newSeasonHref: string;
  onOpenPurchaseList: (seasonId: string) => void;
}) {
  const archiveMutation = useArchiveSeason();
  const [archiveConfirm, setArchiveConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const displaySeasons = useMemo(
    () => seasons.filter((season) => season.status !== "ARCHIVED"),
    [seasons],
  );

  const timelineQueries = useQueries({
    queries: displaySeasons.map((season) => ({
      queryKey: queryKeys.seasonTimeline(season.id),
      queryFn: () => getTimeline(season.id),
      staleTime: 60_000,
    })),
  });

  const progressBySeasonId = useMemo(() => {
    const map = new Map<string, { done: number; total: number; pct: number }>();
    displaySeasons.forEach((season, index) => {
      const raw = timelineQueries[index]?.data;
      const rows = (
        Array.isArray(raw)
          ? raw
          : ((raw as { data?: Recommendation[] } | undefined)?.data ?? [])
      ) as Recommendation[];
      const progress = seasonProgressFromTimeline(rows);
      if (progress) map.set(season.id, progress);
    });
    return map;
  }, [displaySeasons, timelineQueries]);

  if (isLoading) return <ListCardsSkeleton count={3} />;

  if (displaySeasons.length === 0) {
    return (
      <EmptyState
        title="Nenhuma safra nesta fazenda."
        description="Configure a primeira safra para gerar o cronograma de aplicações."
        action={
          producerId ? (
            <Button asChild size="sm">
              <Link href={newSeasonHref}>Configurar safra</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-text-strong">
            Safras desta fazenda
          </h2>
          {producerId ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link href={newSeasonHref}>
                <Plus className="h-4 w-4" />
                Nova safra
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          {displaySeasons.map((season) => {
            const recommendationHref = producerId
              ? `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(producerId)}`
              : `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}`;
            const costPlanHref = producerId
              ? `/seasons/${season.id}?tab=cost-plan&farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(producerId)}`
              : `/seasons/${season.id}?tab=cost-plan&farm_id=${encodeURIComponent(farmId)}`;
            const displayName = `${CROP_LABELS[season.crop] ?? season.crop}${
              season.variety ? ` — ${season.variety}` : ""
            }`;
            const progress = progressBySeasonId.get(season.id);

            return (
              <Card key={season.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 px-4 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                      <Leaf className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-foreground">{displayName}</p>
                        <Badge
                          className="shrink-0"
                          variant={STATUS_VARIANTS[season.status] ?? "default"}
                        >
                          {STATUS_LABELS[season.status] ?? season.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Talhão {season.plot_name}
                      </p>
                    </div>
                  </div>

                  {progress ? (
                    <div className="border-t border-border bg-rail px-4 py-3">
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {progress.done}/{progress.total} aplicadas
                        </span>
                        <span className="font-semibold tabular-nums text-primary-strong">
                          {progress.pct}%
                        </span>
                      </div>
                      <ProgressBar value={progress.pct} />
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link href={recommendationHref}>
                        <CalendarDays className="size-3.5" />
                        Ver Recomendação
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => onOpenPurchaseList(season.id)}
                    >
                      <ShoppingCart className="size-3.5" />
                      Lista de compra
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
                        className={cn("ml-auto text-muted-foreground", deactivateOutlineButtonClass)}
                        onClick={() =>
                          setArchiveConfirm({ id: season.id, name: displayName })
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
      </div>

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(open) => !open && setArchiveConfirm(null)}
        title="Remover safra"
        description={
          archiveConfirm
            ? `A safra "${archiveConfirm.name}" será movida para Removidas.`
            : undefined
        }
        confirmLabel="Remover"
        tone="destructive"
        loading={archiveMutation.isPending}
        onConfirm={async () => {
          if (!archiveConfirm) return;
          await new Promise<void>((resolve, reject) =>
            archiveMutation.mutate(archiveConfirm.id, {
              onSuccess: () => {
                setArchiveConfirm(null);
                toast.success("Safra removida.");
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

function ActiveSeasonsRecommendationFallback({
  activeSeasons,
  farmId,
  producerId,
  newSeasonHref,
  hint,
}: {
  activeSeasons: Array<{
    id: string;
    plot_name: string;
    crop: string;
    variety?: string | null;
    status: string;
  }>;
  farmId: string;
  producerId: string | null;
  newSeasonHref: string;
  hint?: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {hint ??
            `Há ${activeSeasons.length} ${activeSeasons.length === 1 ? "safra ativa" : "safras ativas"} nesta fazenda. Abra a linha do tempo de cada safra para ver o cronograma de aplicação.`}
        </CardContent>
      </Card>
      <div className="space-y-3">
        {activeSeasons.map((season) => {
          const href = producerId
            ? `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(producerId)}`
            : `/seasons/${season.id}?tab=recommendations&farm_id=${encodeURIComponent(farmId)}`;
          return (
            <Card key={season.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{season.plot_name}</p>
                  <p className="font-semibold text-foreground">
                    {CROP_LABELS[season.crop] ?? season.crop}
                    {season.variety ? ` — ${season.variety}` : ""}
                  </p>
                  <Badge
                    className="mt-2"
                    variant={STATUS_VARIANTS[season.status] ?? "default"}
                  >
                    {STATUS_LABELS[season.status] ?? season.status}
                  </Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={href}>
                    <Eye className="h-4 w-4" />
                    Ver Recomendação
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button asChild size="sm" variant="outline">
          <Link href={newSeasonHref}>Configurar nova safra</Link>
        </Button>
      </div>
    </div>
  );
}

function FarmRecommendationTab({
  list,
  isLoading,
  newSeasonHref,
  activeSeasons,
  farmId,
  producerId,
}: {
  list: PurchaseListDetail | null;
  isLoading: boolean;
  newSeasonHref: string;
  activeSeasons: Array<{
    id: string;
    plot_name: string;
    crop: string;
    variety?: string | null;
    status: string;
  }>;
  farmId: string;
  producerId: string | null;
}) {
  if (isLoading) return <ListCardsSkeleton count={3} />;

  if (!list) {
    if (activeSeasons.length > 0) {
      return (
        <ActiveSeasonsRecommendationFallback
          activeSeasons={activeSeasons}
          farmId={farmId}
          producerId={producerId}
          newSeasonHref={newSeasonHref}
        />
      );
    }

    return (
      <EmptyState
        title="Configure uma safra para ver o cronograma e as datas por talhão."
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Configurar safra</Link></Button>}
      />
    );
  }

  const plotRows = list.plots ?? [];
  const listItems = list.items ?? [];

  if (plotRows.length === 0 && listItems.length === 0) {
    if (activeSeasons.length > 0) {
      return (
        <ActiveSeasonsRecommendationFallback
          activeSeasons={activeSeasons}
          farmId={farmId}
          producerId={producerId}
          newSeasonHref={newSeasonHref}
          hint="As safras abaixo foram criadas sem lista de compra vinculada. Abra cada safra ou configure uma nova safra completa."
        />
      );
    }

    return (
      <EmptyState
        title={`A lista "${list.name}" ainda não tem talhões ou produtos vinculados.`}
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Atualizar safra</Link></Button>}
      />
    );
  }

  const itemsByStage = (list.items ?? []).reduce<Map<string, PurchaseListDetail["items"]>>(
    (map, item) => {
      const group = map.get(item.stage) ?? [];
      group.push(item);
      map.set(item.stage, group);
      return map;
    },
    new Map(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-text-strong">Datas por talhão</h2>
        <div className="mt-3 flex flex-col gap-3">
          {plotRows.map((plot) => (
            <Card key={plot.id}>
              <CardContent className="p-4">
                <p className="font-medium text-foreground">
                  {plot.plot_name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    · {fmtQty(plot.area_hectares)} ha
                  </span>
                </p>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Dessecação</dt>
                    <dd className="font-medium text-foreground">
                      {plot.desiccation_date
                        ? new Date(plot.desiccation_date).toLocaleDateString("pt-BR")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Plantio</dt>
                    <dd className="font-medium text-foreground">
                      {plot.planting_date
                        ? new Date(plot.planting_date).toLocaleDateString("pt-BR")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ciclo</dt>
                    <dd className="font-medium text-foreground">
                      {plot.cycle_days ? `${plot.cycle_days} dias` : "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {listItems.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-text-strong">Produtos por etapa</h2>
          <div className="mt-3 flex flex-col gap-4">
            {Array.from(itemsByStage.entries()).map(([stage, stageItems]) => (
              <Card key={stage}>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-foreground">{stage}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {stageItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-foreground">{item.product_name}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {fmtQty(item.dose_per_hectare)} {item.dose_unit}/ha ·{" "}
                          {item.n_applications} apl.
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
