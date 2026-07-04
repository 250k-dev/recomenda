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
  useFarmCycles,
  useFarmPurchaseLists,
  useFarmSeasons,
  useGrantFarmAccess,
  useProducer,
  useProducerPurchaseLists,
  useProducers,
  useRevokeFarmAccess,
  useUpdateFarm,
  useArchiveSeason,
  useMe,
  queryKeys,
} from "@/lib/api/hooks";
import { getTimeline, type Recommendation } from "@/lib/api/seasons";
import {
  FarmSeasonsExportDialog,
  type FarmExportItem,
} from "@/components/domain/farm-seasons-export-dialog";
import { FarmCyclesSection } from "@/components/domain/farm-cycles-section";
import { ProducerStockSection } from "@/components/domain/producer-stock-section";
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
  Share2,
} from "lucide-react";

const SEASON_PRIORITY: Record<string, number> = {
  IN_PROGRESS: 0,
  PUBLISHED: 1,
  DRAFT: 2,
  HARVESTED: 3,
  ARCHIVED: 4,
};

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

type FarmViewTab = "seasons" | "plots" | "stock";

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
  if (value === "plots" || value === "seasons" || value === "stock") {
    return value;
  }
  // Links legados com tab=purchase caem nas safras (a lista vive na safra).
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
  const { data: me } = useMe();
  const { data: access, isLoading: loadingAccess } = useFarmAccess(farmId);

  const resolvedProducerId = useMemo(() => {
    if (producerId) return producerId;
    if (access?.length === 1) return access[0].producer_id;
    return null;
  }, [producerId, access]);
  const updateFarm = useUpdateFarm(farmId);
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: seasons, isLoading: loadingSeasons } = useFarmSeasons(farmId);
  const { data: cycles } = useFarmCycles(farmId);
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

  const [plotsPanelOpen, setPlotsPanelOpen] = useState(false);

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

  // Conta safras (ciclos), não as programações por talhão dentro delas —
  // do contrário uma safra com 3 talhões aparecia como "3 safras ativas".
  const activeSeasonsCount = useMemo(
    () => (cycles ?? []).filter((c) => c.status === "ACTIVE").length,
    [cycles],
  );

  const openPlotsPanel = useCallback(() => {
    setPlotsPanelOpen(true);
    setFarmViewWithUrl("plots");
  }, [setFarmViewWithUrl]);

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

  const stockHref = resolvedProducerId
    ? `/farms/${farmId}?producer_id=${encodeURIComponent(resolvedProducerId)}&tab=stock`
    : `/farms/${farmId}?tab=stock`;

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
            <form onSubmit={onUpdateFarm} className="space-y-4 px-4 pb-4">
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

      {tabFromUrl !== "stock" ? (
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
        </KpiStrip>
      ) : null}

      {tabFromUrl === "stock" ? (
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
          {resolvedProducerId ? (
            <ProducerStockSection producerId={resolvedProducerId} />
          ) : (
            <EmptyState
              title="Produtor não vinculado"
              description="Associe um produtor a esta fazenda para gerenciar o estoque."
            />
          )}
        </section>
      ) : (
        <section>
          <FarmCyclesSection
            farmId={farmId}
            producerId={resolvedProducerId}
            stockHref={stockHref}
          />
        </section>
      )}

      <Sheet open={plotsPanelOpen} onOpenChange={handlePlotsPanelChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Talhões</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
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
                  <form onSubmit={onAddPlot} className="space-y-4 px-4 pb-4">
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

