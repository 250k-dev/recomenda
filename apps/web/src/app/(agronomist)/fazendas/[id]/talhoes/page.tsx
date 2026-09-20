"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { BreadcrumbBack, type BreadcrumbItem } from "@/components/domain/breadcrumb-back";
import { PageHero } from "@/components/domain/page-hero";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { Button } from "@recomenda/ui/primitives/button";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@recomenda/ui/primitives/sheet";
import {
  queryKeys,
  useCreatePlot,
  useDeletePlot,
  useFarm,
  useFarmCycles,
  useFarmPlots,
  useFarmSeasons,
  useProducer,
  useUpdatePlot,
} from "@recomenda/api-hooks";
import { getCycle } from "@recomenda/api/cycles";
import { apiErrorCode, plotInCycleNames } from "@recomenda/api/api-error";
import type { Plot } from "@recomenda/api/farms";
import { routes } from "@recomenda/config";
import { CROP_LABELS } from "@recomenda/utils";
import {
  PlotDeleteDialog,
  type PlotDeleteTarget,
} from "@/components/domain/plot-delete-dialog";
import {
  applyTableView,
  columnOptions,
  ColumnFilterHeader,
  isTableViewActive,
  withColumnFilter,
  type ColumnAccessor,
  type TableView,
} from "@/components/domain/table-column-filter";

const plotSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  area_hectares: z.number().positive("Área deve ser maior que zero"),
});

type PlotFormValues = z.infer<typeof plotSchema>;

type PlotSheetState = { mode: "create" } | { mode: "edit"; plot: Plot } | null;

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type PlotCol = "name" | "area" | "seasons";

type PlotRow = Plot & {
  area: number;
  seasonsLabel: string;
};

const EMPTY_PLOT_VIEW: TableView<PlotCol> = { sort: null, filters: {} };

const PLOT_COLUMNS: Record<PlotCol, ColumnAccessor<PlotRow>> = {
  name: { kind: "text", get: (p) => p.name },
  area: { kind: "range", get: (p) => p.area },
  seasons: { kind: "options", get: (p) => p.seasonsLabel || "—" },
};

export default function FarmPlotsPage() {
  const params = useParams<{ id: string }>();
  const farmId = params.id;
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id");

  const { data: farm } = useFarm(farmId);
  const { data: producer } = useProducer(producerId ?? "");
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: seasons } = useFarmSeasons(farmId);
  const { data: cycles } = useFarmCycles(farmId);

  // Detalhe de cada safra ativa para mapear talhão → nome da safra
  // (a coluna "Safras vinculadas" do design mostra "Safra 2026", não a cultura).
  const activeCycles = useMemo(
    () => (cycles ?? []).filter((c) => c.status === "ACTIVE" && !c.backfill),
    [cycles],
  );
  const cycleDetailQueries = useQueries({
    queries: activeCycles.map((c) => ({
      queryKey: queryKeys.cycle(c.id),
      queryFn: () => getCycle(c.id),
      staleTime: 60_000,
    })),
  });

  const createPlot = useCreatePlot(farmId);
  const updatePlot = useUpdatePlot(farmId);
  const deletePlot = useDeletePlot(farmId);

  const [search, setSearch] = useState("");
  const [tableView, setTableView] = useState<TableView<PlotCol>>(EMPTY_PLOT_VIEW);
  const [sheetState, setSheetState] = useState<PlotSheetState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlotDeleteTarget | null>(
    null,
  );

  const plotForm = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: { name: "", area_hectares: 0 },
  });

  const openCreate = () => {
    plotForm.reset({ name: "", area_hectares: 0 });
    setSheetState({ mode: "create" });
  };

  const openEdit = (plot: Plot) => {
    plotForm.reset({
      name: plot.name,
      area_hectares: Number(plot.area_hectares) || 0,
    });
    setSheetState({ mode: "edit", plot });
  };

  const onSubmitPlot = plotForm.handleSubmit((values) => {
    if (sheetState?.mode === "edit") {
      updatePlot.mutate(
        { id: sheetState.plot.id, ...values },
        {
          onSuccess: () => {
            setSheetState(null);
            toast.success("Talhão atualizado!");
          },
          onError: () => toast.error("Não foi possível atualizar o talhão."),
        },
      );
      return;
    }
    createPlot.mutate(values, {
      onSuccess: () => {
        setSheetState(null);
        plotForm.reset();
        toast.success("Talhão adicionado!");
      },
      onError: () => toast.error("Não foi possível adicionar o talhão."),
    });
  });

  /** Nomes das safras (ciclos) por talhão — coluna "Safras vinculadas" do
   *  design ("Safra 2026"). Programações fora de ciclo (legado) caem no nome
   *  da cultura. */
  const seasonsByPlot = useMemo(() => {
    const map = new Map<string, string[]>();
    const add = (plotId: string, label: string) => {
      const list = map.get(plotId) ?? [];
      if (!list.includes(label)) list.push(label);
      map.set(plotId, list);
    };
    const plotsInCycles = new Set<string>();
    for (const query of cycleDetailQueries) {
      const cycle = query.data;
      if (!cycle) continue;
      for (const s of cycle.seasons ?? []) {
        if (s.status === "ARCHIVED") continue;
        plotsInCycles.add(s.plot_id);
        add(s.plot_id, cycle.name);
      }
    }
    for (const s of seasons ?? []) {
      if (!s.plot_id || s.status === "ARCHIVED") continue;
      if (plotsInCycles.has(s.plot_id)) continue;
      add(s.plot_id, CROP_LABELS[s.crop] ?? s.crop);
    }
    return map;
  }, [cycleDetailQueries, seasons]);

  const plotRows = useMemo((): PlotRow[] => {
    return (plots ?? []).map((plot) => ({
      ...plot,
      area: Number(plot.area_hectares) || 0,
      seasonsLabel: (seasonsByPlot.get(plot.id) ?? []).join(" · "),
    }));
  }, [plots, seasonsByPlot]);

  const searchedPlots = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return plotRows;
    return plotRows.filter((plot) =>
      plot.name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [plotRows, search]);

  const filteredPlots = useMemo(
    () => applyTableView(searchedPlots, tableView, PLOT_COLUMNS),
    [searchedPlots, tableView],
  );

  const renderPlotHeader = (
    column: PlotCol,
    label: string,
    showFilter = true,
  ) => {
    const accessor = PLOT_COLUMNS[column];
    return (
      <ColumnFilterHeader
        label={label}
        kind={accessor.kind}
        sort={tableView.sort?.column === column ? tableView.sort.dir : null}
        onSortChange={(dir) =>
          setTableView((v) => ({
            ...v,
            sort: dir
              ? { column, dir }
              : v.sort?.column === column
                ? null
                : v.sort,
          }))
        }
        filter={tableView.filters[column]}
        onFilterChange={(filter) =>
          setTableView((v) => withColumnFilter(v, column, filter))
        }
        options={
          accessor.kind === "options"
            ? columnOptions(searchedPlots, accessor)
            : undefined
        }
        showFilter={showFilter}
      />
    );
  };

  const askDeletePlot = (plot: Plot) => {
    setDeleteConfirm({
      id: plot.id,
      name: plot.name,
      cycleNames: seasonsByPlot.get(plot.id) ?? [],
    });
  };

  const runDeletePlot = async (id: string, unlinkFromCycle: boolean) => {
    const snapshot = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deletePlot.mutateAsync({ id, unlinkFromCycle });
      toast.success(
        unlinkFromCycle
          ? "Talhão removido da safra e excluído."
          : "Talhão excluído.",
      );
    } catch (err) {
      if (apiErrorCode(err) === "PLOT_IN_CYCLE") {
        setDeleteConfirm({
          id,
          name: snapshot?.name ?? "Talhão",
          cycleNames: plotInCycleNames(err),
        });
        return;
      }
      toast.error(
        "Não foi possível excluir o talhão. Verifique se ele não está em uso em alguma safra.",
      );
    }
  };

  const totalHectares = useMemo(
    () =>
      (plots ?? []).reduce((acc, p) => acc + (Number(p.area_hectares) || 0), 0),
    [plots],
  );

  const inUseCount = useMemo(
    () => (plots ?? []).filter((p) => seasonsByPlot.has(p.id)).length,
    [plots, seasonsByPlot],
  );

  const farmHref = routes.fazendas.detalhe(farmId, {
    producer_id: producerId,
  });

  const plotHref = (plotId: string) =>
    routes.fazendas.talhao(farmId, plotId, { producer_id: producerId });

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Produtores", href: routes.produtores.lista },
    ...(producerId && producer
      ? [{ label: producer.name, href: routes.produtores.detalhe(producerId) }]
      : []),
    { label: farm?.name ?? "Fazenda", href: farmHref },
    { label: "Talhões" },
  ];

  const sheetOpen = sheetState !== null;
  const isEditing = sheetState?.mode === "edit";
  const savingPlot = createPlot.isPending || updatePlot.isPending;

  return (
    <>
      <BreadcrumbBack items={breadcrumbs} />

      <PageHero
        icon={<MapPin className="size-6" />}
        eyebrow="Fazenda · Base"
        title="Talhões da fazenda"
        stats={[
          ...(farm?.name ? [{ label: "Fazenda", value: farm.name }] : []),
          ...(farm?.created_by_name?.trim()
            ? [{ label: "Criado por", value: farm.created_by_name.trim() }]
            : []),
          { label: "Talhões", value: plots?.length ?? 0 },
          { label: "Área total", value: `${fmtHa(totalHectares)} ha` },
          { label: "Em uso", value: inUseCount },
        ]}
      />

      <section>
        <SectionToolbar
          title="Talhões cadastrados"
          search={
            plotRows.length > 0
              ? { value: search, onChange: setSearch, placeholder: "Buscar talhão…" }
              : undefined
          }
          actions={
            <Button className="hidden gap-2 sm:inline-flex" onClick={openCreate}>
              <Plus className="size-4" />
              Novo talhão
            </Button>
          }
        />

        {loadingPlots ? (
          <ListCardsSkeleton count={4} />
        ) : plotRows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Nenhum talhão cadastrado"
            description="Cadastre talhões para começar a planejar safras."
            action={
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="size-4" />
                Adicionar primeiro talhão
              </Button>
            }
          />
        ) : filteredPlots.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nenhum talhão encontrado."
            description={
              isTableViewActive(tableView)
                ? "Nenhum talhão com esses filtros."
                : `Não há talhões com o nome "${search.trim()}".`
            }
          />
        ) : (
          <>
            <div className="mb-2 flex justify-end md:hidden">
              {renderPlotHeader("name", "Talhão", false)}
            </div>
            {/* Desktop: tabela */}
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_13rem] gap-4 bg-surface-2 px-5 py-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                {renderPlotHeader("name", "Talhão")}
                {renderPlotHeader("area", "Área")}
                {renderPlotHeader("seasons", "Safras vinculadas")}
                <span className="text-right">Ações</span>
              </div>
              {filteredPlots.map((plot) => {
                const linked = seasonsByPlot.get(plot.id);
                return (
                  <div
                    key={plot.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)_13rem] items-center gap-4 border-t border-border px-5 py-3.5 text-sm"
                  >
                    <Link
                      href={plotHref(plot.id)}
                      className="truncate font-semibold text-text-strong underline-offset-4 hover:text-primary-strong hover:underline"
                      title={`Ver talhão ${plot.name}`}
                    >
                      {plot.name}
                    </Link>
                    <span className="tabular-nums">
                      {fmtHa(Number(plot.area_hectares) || 0)} ha
                    </span>
                    <span className="truncate text-muted-foreground">
                      {linked?.length ? linked.join(" · ") : "—"}
                    </span>
                    <span className="flex justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openEdit(plot)}
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
                        disabled={deletePlot.isPending}
                        onClick={() => askDeletePlot(plot)}
                      >
                        <Trash2 className="size-3.5" />
                        Excluir
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: cards */}
            <div className="flex flex-col gap-2.5 md:hidden">
              {filteredPlots.map((plot) => {
                const linked = seasonsByPlot.get(plot.id);
                return (
                  <div
                    key={plot.id}
                    className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={plotHref(plot.id)}
                          className="block truncate text-sm font-semibold text-text-strong"
                        >
                          {plot.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {fmtHa(Number(plot.area_hectares) || 0)} ha ·{" "}
                          {linked?.length ? linked.join(" · ") : "sem safra"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(plot)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
                          disabled={deletePlot.isPending}
                          onClick={() => askDeletePlot(plot)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <StickyMobileCta>
        <Button size="lg" className="gap-2" onClick={openCreate}>
          <Plus className="size-4" />
          Novo talhão
        </Button>
      </StickyMobileCta>

      {/* Novo / editar talhão */}
      <Sheet open={sheetOpen} onOpenChange={(open) => !open && setSheetState(null)}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{isEditing ? "Editar talhão" : "Novo talhão"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmitPlot} className="space-y-4 px-4 pb-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">
                Nome
              </label>
              <Input {...plotForm.register("name")} placeholder="Ex: Talhão 1" />
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
                {...plotForm.register("area_hectares", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {plotForm.formState.errors.area_hectares && (
                <p className="mt-1 text-xs text-destructive">
                  {plotForm.formState.errors.area_hectares.message}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={savingPlot} className="flex-1">
                {savingPlot
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar"
                    : "Adicionar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetState(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <PlotDeleteDialog
        target={deleteConfirm}
        loading={deletePlot.isPending}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onDelete={(id) => runDeletePlot(id, false)}
        onUnlinkAndDelete={(id) => runDeletePlot(id, true)}
      />
    </>
  );
}
