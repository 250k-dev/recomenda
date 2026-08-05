"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2, Search } from "lucide-react";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { ConfirmDialog } from "@recomenda/ui/patterns/confirm-dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@recomenda/ui/primitives/sheet";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import {
  queryKeys,
  useCreatePlot,
  useDeletePlot,
  useFarmCycles,
  useFarmPlots,
  useFarmSeasons,
  useUpdatePlot,
} from "@recomenda/api-hooks";
import { getCycle } from "@recomenda/api/cycles";
import type { Plot } from "@recomenda/api/farms";
import { CROP_LABELS } from "@recomenda/utils";

const plotSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  area_hectares: z.number().positive("Área deve ser maior que zero"),
});

type PlotFormValues = z.infer<typeof plotSchema>;
type PlotSheetState = { mode: "create" } | { mode: "edit"; plot: Plot } | null;

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type PlotMeta = {
  cycleName: string | null;
  cropLabel: string | null;
};

/** Talhões cadastrados da fazenda — tabela com Em safra, cultura e ações (lápis/lixeira). */
export function FarmPlotsSection({ farmId }: { farmId: string }) {
  const { data: plots, isLoading: loadingPlots } = useFarmPlots(farmId);
  const { data: seasons } = useFarmSeasons(farmId);
  const { data: cycles } = useFarmCycles(farmId);

  const activeCycles = useMemo(
    () => (cycles ?? []).filter((c) => c.status !== "ARCHIVED"),
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
  const [sheetState, setSheetState] = useState<PlotSheetState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  const metaByPlot = useMemo(() => {
    const map = new Map<string, PlotMeta>();
    const setMeta = (plotId: string, partial: Partial<PlotMeta>) => {
      const cur = map.get(plotId) ?? { cycleName: null, cropLabel: null };
      map.set(plotId, { ...cur, ...partial });
    };

    for (const query of cycleDetailQueries) {
      const cycle = query.data;
      if (!cycle || cycle.status === "ARCHIVED") continue;
      for (const s of cycle.seasons ?? []) {
        if (s.status === "ARCHIVED") continue;
        const variety = s.variety?.trim();
        const cropLabel = `${CROP_LABELS[s.crop] ?? s.crop}${
          variety ? ` – ${variety}` : ""
        }`;
        // Prefere safra ACTIVE sobre as demais.
        const existing = map.get(s.plot_id);
        if (existing?.cycleName && cycle.status !== "ACTIVE") continue;
        setMeta(s.plot_id, { cycleName: cycle.name, cropLabel });
      }
    }

    for (const s of seasons ?? []) {
      if (!s.plot_id || s.status === "ARCHIVED") continue;
      if (map.has(s.plot_id)) continue;
      const variety =
        "variety" in s && typeof s.variety === "string" ? s.variety.trim() : "";
      setMeta(s.plot_id, {
        cycleName: null,
        cropLabel: `${CROP_LABELS[s.crop] ?? s.crop}${
          variety ? ` – ${variety}` : ""
        }`,
      });
    }

    return map;
  }, [cycleDetailQueries, seasons]);

  const sortedPlots = useMemo(() => {
    if (!plots) return [];
    return [...plots].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [plots]);

  const filteredPlots = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return sortedPlots;
    return sortedPlots.filter((plot) =>
      plot.name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [sortedPlots, search]);

  const sheetOpen = sheetState !== null;
  const isEditing = sheetState?.mode === "edit";
  const savingPlot = createPlot.isPending || updatePlot.isPending;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="min-w-0 font-display text-lg font-semibold text-text-strong">
          Talhões cadastrados
          {sortedPlots.length > 0 ? (
            <span className="ml-2 text-base font-medium text-muted-foreground">
              {sortedPlots.length}
            </span>
          ) : null}
        </h2>
        <div className="hidden min-w-4 flex-1 sm:block" />
        {sortedPlots.length > 0 ? (
          <div className="relative w-full sm:w-60 lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar talhão…"
              aria-label="Buscar talhão"
              className="h-10 pl-9"
            />
          </div>
        ) : null}
        <Button
          className="hidden h-10 gap-2 sm:inline-flex"
          onClick={openCreate}
        >
          <Plus className="size-4" />
          Novo talhão
        </Button>
      </div>

      {loadingPlots ? (
        <ListCardsSkeleton count={4} />
      ) : sortedPlots.length === 0 ? (
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
          description={`Não há talhões com o nome "${search.trim()}".`}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_7rem] gap-4 bg-surface-2 px-5 py-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              <span>Talhão</span>
              <span>Área</span>
              <span>Em safra</span>
              <span>Cultura atual</span>
              <span className="text-right">Ações</span>
            </div>
            {filteredPlots.map((plot) => {
              const meta = metaByPlot.get(plot.id);
              return (
                <div
                  key={plot.id}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_7rem] items-center gap-4 border-t border-border px-5 py-3.5 text-sm"
                >
                  <span className="truncate font-semibold text-text-strong">
                    {plot.name.startsWith("Talhão")
                      ? plot.name
                      : `Talhão ${plot.name}`}
                  </span>
                  <span className="tabular-nums">
                    {fmtHa(Number(plot.area_hectares) || 0)} ha
                  </span>
                  <span>
                    {meta?.cycleName ? (
                      <Badge variant="primary" className="max-w-full truncate">
                        {meta.cycleName}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">Sem safra</Badge>
                    )}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {meta?.cropLabel ?? "—"}
                  </span>
                  <span className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-text-strong"
                      aria-label={`Editar talhão ${plot.name}`}
                      onClick={() => openEdit(plot)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-warning-strong hover:bg-warning-soft hover:text-warning-strong"
                      aria-label={`Excluir talhão ${plot.name}`}
                      disabled={deletePlot.isPending}
                      onClick={() =>
                        setDeleteConfirm({ id: plot.id, name: plot.name })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2.5 md:hidden">
            {filteredPlots.map((plot) => {
              const meta = metaByPlot.get(plot.id);
              return (
                <div
                  key={plot.id}
                  className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-strong">
                        {plot.name.startsWith("Talhão")
                          ? plot.name
                          : `Talhão ${plot.name}`}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {fmtHa(Number(plot.area_hectares) || 0)} ha
                        {meta?.cropLabel ? ` · ${meta.cropLabel}` : ""}
                      </p>
                      <div className="mt-2">
                        {meta?.cycleName ? (
                          <Badge variant="primary">{meta.cycleName}</Badge>
                        ) : (
                          <Badge variant="neutral">Sem safra</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar talhão ${plot.name}`}
                        onClick={() => openEdit(plot)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-warning-strong hover:bg-warning-soft"
                        aria-label={`Excluir talhão ${plot.name}`}
                        disabled={deletePlot.isPending}
                        onClick={() =>
                          setDeleteConfirm({ id: plot.id, name: plot.name })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <StickyMobileCta>
        <Button size="lg" className="gap-2" onClick={openCreate}>
          <Plus className="size-4" />
          Novo talhão
        </Button>
      </StickyMobileCta>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => !open && setSheetState(null)}
      >
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Editar talhão" : "Novo talhão"}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmitPlot} className="space-y-4 px-4 pb-4">
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

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir talhão"
        description={
          deleteConfirm
            ? `Excluir o talhão "${deleteConfirm.name}"? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        tone="destructive"
        loading={deletePlot.isPending}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          const id = deleteConfirm.id;
          setDeleteConfirm(null);
          try {
            await deletePlot.mutateAsync(id);
            toast.success("Talhão excluído.");
          } catch {
            toast.error(
              "Não foi possível excluir o talhão. Verifique se ele não está em uso em alguma safra.",
            );
          }
        }}
      />
    </section>
  );
}
