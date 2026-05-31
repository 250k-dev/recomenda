"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PageHeader } from "@/components/domain/page-header";
import { BreadcrumbBack } from "@/components/domain/breadcrumb-back";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedTabs } from "@/components/domain/segmented-tabs";
import { StatCard } from "@/components/domain/stat-card";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
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
  useFarmAggregatedShoppingList,
  useProducers,
  useRevokeFarmAccess,
  useUpdateFarm,
} from "@/lib/api/hooks";
import type { PurchaseListDetail } from "@/lib/api/client";
import { activeAgronomistProducerAccounts } from "@/lib/api/client";
import { toast } from "sonner";
import { CROP_LABELS, STATUS_LABELS, STATUS_VARIANTS } from "@/lib/season-constants";
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

type FarmTab = "purchase" | "recommendation";

const fmtQty = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function FarmDetailPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

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
  const [activeTab, setActiveTab] = useState<FarmTab>("purchase");
  const [farmView, setFarmView] = useState<"plots" | "purchase">("plots");

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

  /** Extrai o ano da lista — busca padrão "26/27" ou "2026" no nome,
   *  com fallback para o ano de criação. */
  const yearForList = (list: { name: string; created_at: string }) => {
    const m = list.name.match(/(\d{2}\/\d{2})|(\d{4})/);
    if (m) return m[0];
    return String(new Date(list.created_at).getFullYear());
  };

  /** Agrupa as listas por ano para alimentar os dois selects (Ano + Safra). */
  const listsByYear = useMemo(() => {
    const map = new Map<string, typeof farmPurchaseListsResolved>();
    for (const list of farmPurchaseListsResolved) {
      const y = yearForList(list);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(list);
    }
    return map;
  }, [farmPurchaseListsResolved]);

  const yearOptions = useMemo(
    () => Array.from(listsByYear.keys()).sort().reverse(),
    [listsByYear],
  );

  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedListId, setSelectedListId] = useState<string>("");

  // Sincroniza o ano/safra selecionados quando as listas carregam.
  useEffect(() => {
    if (yearOptions.length === 0) return;
    if (!selectedYear || !yearOptions.includes(selectedYear)) {
      const fallback = yearOptions[0];
      setSelectedYear(fallback);
      const firstList = listsByYear.get(fallback)?.[0];
      if (firstList) setSelectedListId(firstList.id);
    }
  }, [yearOptions, selectedYear, listsByYear]);

  // Quando troca o ano, escolhe a 1ª safra desse ano.
  useEffect(() => {
    if (!selectedYear) return;
    const lists = listsByYear.get(selectedYear) ?? [];
    if (lists.length === 0) {
      setSelectedListId("");
      return;
    }
    if (!lists.find((l) => l.id === selectedListId)) {
      setSelectedListId(lists[0].id);
    }
  }, [selectedYear, listsByYear, selectedListId]);

  const selectedList = useMemo(
    () =>
      farmPurchaseListsResolved.find((l) => l.id === selectedListId) ??
      latestPurchaseList,
    [farmPurchaseListsResolved, selectedListId, latestPurchaseList],
  );

  const safraOptionsForYear = useMemo(
    () => listsByYear.get(selectedYear) ?? [],
    [listsByYear, selectedYear],
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

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHeader
        title={farm?.name ?? "Detalhes da fazenda"}
        description={farm?.location ?? "Sem localização cadastrada"}
        action={
          <div className="flex flex-wrap items-center gap-2">
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

            {yearOptions.length > 0 ? (
              <>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Ano</span>
                  <NativeSelect
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-9 w-24"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">Safra</span>
                  <NativeSelect
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="h-9 min-w-[180px]"
                  >
                    {safraOptionsForYear.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                        {l.variety ? ` — ${l.variety}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </>
            ) : null}

            <Link href={newSeasonHref}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova safra
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Talhões"
          value={plots?.length ?? 0}
          icon={<MapPin className="h-4 w-4" />}
          accent="primary"
        />
        <StatCard
          label="Área total"
          value={`${totalHectares.toFixed(2)} ha`}
          icon={<Sprout className="h-4 w-4" />}
          accent="sun"
        />
        <StatCard
          label="Safras ativas"
          value={activeSeasonsCount}
          icon={<Leaf className="h-4 w-4" />}
          accent="sky"
        />
      </div>

      <div className="mb-5">
        <SegmentedTabs
          variant="pill"
          value={farmView}
          onValueChange={setFarmView}
          items={[
            { value: "plots", label: "Talhões" },
            { value: "purchase", label: "Lista de compra" },
          ]}
        />
      </div>

      <div className="grid gap-6">
        <section style={{ display: farmView === "plots" ? undefined : "none" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Talhões
            </h2>
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
            <TableRowsSkeleton rows={4} columns={1} />
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
            <div className="max-h-[calc(100vh-280px)] space-y-3 overflow-y-auto pr-1">
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
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            <Sprout className="h-3 w-3" />
                            {CROP_LABELS[season.crop] ?? season.crop}
                            {season.variety ? ` · ${season.variety}` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
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
                        size="icon"
                        title="Ver detalhes do talhão"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Link href={plotHref} aria-label={`Ver talhão ${plot.name}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remover talhão"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={deletePlot.isPending}
                        onClick={() =>
                          setDeletePlotConfirm({ id: plot.id, name: plot.name })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        </section>

        <section style={{ display: farmView === "purchase" ? undefined : "none" }}>
          <FarmPurchaseListTab
            list={selectedList}
            isLoading={loadingPurchaseLists || loadingSeasons}
            producerId={resolvedProducerId}
            newSeasonHref={newSeasonHref}
            fallbackSeasonIds={activeSeasonIds}
          />
        </section>

      </div>

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

function FarmPurchaseListTab({
  list,
  isLoading,
  producerId,
  newSeasonHref,
  fallbackSeasonIds,
}: {
  list: PurchaseListDetail | null;
  isLoading: boolean;
  producerId: string | null;
  newSeasonHref: string;
  fallbackSeasonIds: string[];
}) {
  if (!producerId) {
    return (
      <EmptyState
        variant="inline"
        title="Abra esta fazenda a partir de um produtor para ver a lista de compra."
      />
    );
  }

  if (isLoading) return <TableRowsSkeleton rows={6} columns={4} />;

  if (!list) {
    if (fallbackSeasonIds.length > 0) {
      return (
        <FarmSeasonShoppingFallback
          seasonIds={fallbackSeasonIds}
          newSeasonHref={newSeasonHref}
        />
      );
    }

    return (
      <EmptyState
        title="Nenhuma lista de compra para esta fazenda."
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Configurar safra</Link></Button>}
      />
    );
  }

  const items = list.items ?? [];
  // Valor total = soma das linhas onde o agrônomo informou preço (price_brl_fixed).
  const totalValue = items.reduce((s, it) => {
    const price = it.price_brl_fixed ?? 0;
    return s + it.quantity_to_buy * price;
  }, 0);
  const productsCount = items.length;
  const categoriesCount = new Set(items.map((it) => it.category || "OTHER")).size;
  const fmtBrl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

  // Agrupa itens por categoria pra renderização estilo Plano de Custo.
  const grouped = [...new Set(items.map((it) => it.category || "OTHER"))]
    .sort()
    .map((cat) => ({
      category: cat,
      items: items.filter((it) => (it.category || "OTHER") === cat),
    }));

  if (items.length === 0) {
    return (
      <EmptyState
        title={`A lista "${list.name}" ainda não tem produtos cadastrados.`}
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Atualizar safra</Link></Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header da lista */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Leaf className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lista de compra · {list.name}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              {CROP_LABELS[list.crop] ?? list.crop}
              {list.variety ? ` · ${list.variety}` : ""}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fmtQty(list.total_hectares)} ha · {(list.plots ?? []).length} talhões
            </p>
          </div>
        </div>
        {list.season_id ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={`/seasons/${list.season_id}?tab=cost-plan`}>
              <Eye className="h-4 w-4" />
              Ver plano de custo
            </Link>
          </Button>
        ) : null}
      </div>

      {/* KPIs no estilo do Plano de Custo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Valor total a gastar"
          value={totalValue > 0 ? fmtBrl(totalValue) : "—"}
          sub={totalValue > 0 ? "soma dos itens com preço" : "informe preços para calcular"}
          accent="primary"
          icon={<Leaf className="h-4 w-4" />}
        />
        <StatCard
          label="Produtos"
          value={String(productsCount)}
          sub={`${categoriesCount} categorias`}
          accent="sky"
          icon={<MapPin className="h-4 w-4" />}
        />
        <StatCard
          label="Hectares"
          value={`${fmtQty(list.total_hectares)} ha`}
          sub={`${(list.plots ?? []).length} talhões`}
          accent="sun"
          icon={<Sprout className="h-4 w-4" />}
        />
        <StatCard
          label="Itens com preço"
          value={`${items.filter((it) => it.price_brl_fixed).length}/${productsCount}`}
          sub="cobertura de preços"
          accent="clay"
          icon={<Pencil className="h-4 w-4" />}
        />
      </div>

      {/* Tabela agrupada por categoria */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">Produto</th>
              <th className="px-2 py-2.5">Dose</th>
              <th className="px-2 py-2.5 text-right">Necessário</th>
              <th className="px-2 py-2.5 text-right">A comprar</th>
              <th className="px-2 py-2.5 text-right">Preço R$/un.</th>
              <th className="px-2 py-2.5 text-right">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ category, items: groupItems }) => {
              const subtotal = groupItems.reduce((s, it) => {
                const p = it.price_brl_fixed ?? 0;
                return s + it.quantity_to_buy * p;
              }, 0);
              return (
                <>
                  <tr key={`h-${category}`} className="bg-muted/40">
                    <td colSpan={6} className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        {CROP_LABELS[category] ?? category}
                        <span className="font-normal text-muted-foreground/70">
                          · {groupItems.length} {groupItems.length === 1 ? "insumo" : "insumos"}
                          {subtotal > 0 ? ` · ${fmtBrl(subtotal)}` : ""}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {groupItems.map((item) => {
                    const price = item.price_brl_fixed ?? null;
                    const lineTotal = price != null ? item.quantity_to_buy * price : null;
                    return (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {item.product_name}
                        </td>
                        <td className="px-2 py-2 tabular-nums text-muted-foreground">
                          {fmtQty(item.dose_per_hectare)} {item.dose_unit}/ha · {item.n_applications}×
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {fmtQty(item.required_quantity)} {item.dose_unit}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-foreground">
                          {fmtQty(item.quantity_to_buy)} {item.dose_unit}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                          {price != null ? fmtBrl(price) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">
                          {lineTotal != null ? fmtBrl(lineTotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function FarmSeasonShoppingFallback({
  seasonIds,
  newSeasonHref,
}: {
  seasonIds: string[];
  newSeasonHref: string;
}) {
  const { items, isLoading } = useFarmAggregatedShoppingList(seasonIds);

  if (isLoading) return <TableRowsSkeleton rows={6} columns={4} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhum produto pendente nas safras ativas desta fazenda."
        action={<Button asChild size="sm"><Link href={newSeasonHref}>Configurar safra</Link></Button>}
      />
    );
  }

  const totalToBuy = items.reduce((s, it) => s + it.quantity_to_buy, 0);
  const rows = items.map((item) => [
    item.product_name,
    "—",
    "—",
    `${fmtQty(item.total_quantity)} ${item.dose_unit}`,
    `${fmtQty(item.quantity_to_buy)} ${item.dose_unit}`,
  ]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Produtos calculados a partir das safras ativas (recomendações pendentes).
          Configure uma safra completa para salvar uma lista de compra fixa.
        </CardContent>
      </Card>
      <DataTable
        headers={["Produto", "Etapa", "Dose", "Necessário", "A comprar"]}
        rows={rows}
      />
      <div className="flex items-baseline justify-between rounded-lg border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">Total a comprar</span>
        <strong className="text-base text-foreground">{fmtQty(totalToBuy)}</strong>
      </div>
    </div>
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
            ? `/seasons/${season.id}?farm_id=${encodeURIComponent(farmId)}&producer_id=${encodeURIComponent(producerId)}`
            : `/seasons/${season.id}?farm_id=${encodeURIComponent(farmId)}`;
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
                    Ver recomendação
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
  if (isLoading) return <TableRowsSkeleton rows={5} columns={1} />;

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
        <h2 className="text-lg font-semibold text-foreground">Datas por talhão</h2>
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
          <h2 className="text-lg font-semibold text-foreground">Produtos por etapa</h2>
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
