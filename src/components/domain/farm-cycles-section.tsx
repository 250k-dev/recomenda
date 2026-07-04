"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Boxes,
  Calculator,
  CalendarDays,
  Check,
  Leaf,
  Plus,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import {
  queryKeys,
  useCreateCycle,
  useCycle,
  useFarmCycles,
  useMe,
  useProducer,
} from "@/lib/api/hooks";
import type { CycleSummary } from "@/lib/api/cycles";
import { getTimeline, type Recommendation } from "@/lib/api/seasons";
import {
  FarmSeasonsExportDialog,
  type FarmExportItem,
} from "@/components/domain/farm-seasons-export-dialog";
import { CROP_LABELS, STATUS_LABELS } from "@/lib/season-constants";
import { cn } from "@/lib/utils";

const CROP_CHOICES = [
  { value: "SOYBEAN", label: "Soja" },
  { value: "CORN", label: "Milho" },
];

const CYCLE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  HARVESTED: "Colhida",
  ARCHIVED: "Removida",
};

const APPLIED = new Set(["APPLIED_ON_TIME", "APPLIED_LATE"]);

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function cycleHref(
  cycle: Pick<CycleSummary, "id" | "farm_id">,
  producerId: string | null,
  tab?: string,
) {
  const params = new URLSearchParams();
  if (producerId) params.set("producer_id", producerId);
  if (tab) params.set("tab", tab);
  const qs = params.toString();
  return `/farms/${cycle.farm_id}/cycles/${cycle.id}${qs ? `?${qs}` : ""}`;
}

/** Diálogo "Nova safra": passo leve (nome + culturas) — a lista de compra e a
 *  programação são montadas depois, dentro da safra. */
export function NewCycleDialog({
  open,
  onOpenChange,
  farmId,
  producerId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  producerId: string;
  onCreated?: (cycleId: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState(
    `Safra ${currentYear}/${String(currentYear + 1).slice(-2)}`,
  );
  const [crops, setCrops] = useState<Set<string>>(new Set(["SOYBEAN"]));
  const createCycle = useCreateCycle(farmId);

  const toggleCrop = (value: string) => {
    setCrops((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("Dê um nome à safra.");
      return;
    }
    if (crops.size === 0) {
      toast.error("Selecione pelo menos uma cultura.");
      return;
    }
    createCycle.mutate(
      { producer_id: producerId, name: name.trim(), crops: [...crops] },
      {
        onSuccess: (cycle) => {
          toast.success("Safra criada! Agora monte a lista de compra e a programação.");
          onOpenChange(false);
          onCreated?.(cycle.id);
        },
        onError: () => toast.error("Não foi possível criar a safra."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova safra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Nome da safra
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Ex: Safra ${currentYear}/${String(currentYear + 1).slice(-2)}`}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              Culturas da safra
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              A safra pode ter mais de uma cultura — cada talhão recebe uma delas.
            </p>
            <div className="flex flex-col gap-2">
              {CROP_CHOICES.map((crop) => {
                const checked = crops.has(crop.value);
                return (
                  <label
                    key={crop.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-hover/40"
                  >
                    <span
                      className={cn(
                        "flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-md transition-colors",
                        checked
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-surface text-transparent",
                      )}
                    >
                      {checked ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCrop(crop.value)}
                      className="sr-only"
                    />
                    <Leaf className="size-4 text-primary-strong" />
                    {crop.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              onClick={submit}
              disabled={createCycle.isPending}
            >
              {createCycle.isPending ? "Criando..." : "Criar safra"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de safras da fazenda (cards de `crop_cycles`). */
export function FarmCyclesSection({
  farmId,
  producerId,
  stockHref,
}: {
  farmId: string;
  producerId: string | null;
  stockHref: string;
}) {
  const router = useRouter();
  const { data: cycles, isLoading } = useFarmCycles(farmId);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCycleId, setExportCycleId] = useState<string | null>(null);

  const visibleCycles = (cycles ?? []).filter((c) => c.status !== "ARCHIVED");
  const exportableCycle = visibleCycles.find((cycle) => cycle.recommendations_total > 0);
  const selectedCycleSummary =
    visibleCycles.find((cycle) => cycle.id === exportCycleId) ?? null;
  const { data: selectedCycle, isLoading: loadingCycleExport } = useCycle(
    exportCycleId ?? "",
  );
  const { data: producer } = useProducer(producerId ?? "");
  const { data: me } = useMe();
  const exportSeasons = selectedCycle?.seasons ?? [];
  const timelineQueries = useQueries({
    queries: exportSeasons.map((season) => ({
      queryKey: queryKeys.seasonTimeline(season.id),
      queryFn: () => getTimeline(season.id),
      enabled: Boolean(exportCycleId),
    })),
  });
  const exportLoading =
    loadingCycleExport || timelineQueries.some((query) => query.isLoading);

  const exportItems = useMemo<FarmExportItem[]>(() => {
    if (!selectedCycle) return [];

    return selectedCycle.seasons.reduce<FarmExportItem[]>((acc, season, index) => {
        const rows = timelineQueries[index]?.data;
        const recommendations = (Array.isArray(rows) ? rows : []) as Recommendation[];
        if (recommendations.length === 0) return acc;

        const cropLabel = CROP_LABELS[season.crop] ?? season.crop;
        const title = season.variety ? `${cropLabel} — ${season.variety}` : cropLabel;
        const done = recommendations.filter((rec) => APPLIED.has(rec.status)).length;

        acc.push({
          id: season.id,
          label: `Talhão ${season.plot_name}`,
          data: {
            title,
            plotName: season.plot_name,
            plantingDate: season.planting_date,
            statusLabel: STATUS_LABELS[season.status] ?? season.status,
            producerName: producer?.name ?? null,
            agronomistName: me?.name ?? null,
            done,
            total: recommendations.length,
            recommendations,
          },
        });

        return acc;
      }, []);
  }, [me?.name, producer?.name, selectedCycle, timelineQueries]);

  const openCycle = (cycleId: string) => {
    router.push(
      cycleHref({ id: cycleId, farm_id: farmId }, producerId),
    );
  };

  const openExport = (cycleId: string) => {
    setExportCycleId(cycleId);
    setExportOpen(true);
  };

  if (isLoading) return <ListCardsSkeleton count={3} />;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-text-strong">
            Safras desta fazenda
          </h2>
          <div className="flex items-center gap-2">
            {exportableCycle ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openExport(exportableCycle.id)}
              >
                <Share2 className="h-4 w-4 text-muted-foreground" />
                Exportar
              </Button>
            ) : null}
            {producerId ? (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setNewCycleOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Nova safra
              </Button>
            ) : null}
          </div>
        </div>

        {visibleCycles.length === 0 ? (
          <EmptyState
            title="Nenhuma safra nesta fazenda."
            description="Crie a safra (nome + culturas), monte a lista de compra e depois a programação dos talhões."
            action={
              producerId ? (
                <Button size="sm" onClick={() => setNewCycleOpen(true)}>
                  Criar primeira safra
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {visibleCycles.map((cycle) => {
              const pct = cycle.progress_pct;
              return (
                <Card key={cycle.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-hover/30"
                      onClick={() => openCycle(cycle.id)}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                        <Leaf className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {cycle.name}
                          </span>
                          {cycle.is_planning ? (
                            <Badge variant="neutral" className="shrink-0">
                              Em planejamento
                            </Badge>
                          ) : (
                            <Badge
                              variant={cycle.status === "HARVESTED" ? "success" : "info"}
                              className="shrink-0"
                            >
                              {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {[
                            cycle.crops
                              .map((c) => CROP_LABELS[c] ?? c)
                              .join(" + "),
                            cycle.is_planning
                              ? "sem talhões programados"
                              : `${cycle.plots_count} ${cycle.plots_count === 1 ? "talhão" : "talhões"}`,
                            cycle.area_ha > 0 ? `${fmtHa(cycle.area_ha)} ha` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>

                    {cycle.recommendations_total > 0 ? (
                      <div className="border-t border-border bg-rail px-4 py-3">
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {cycle.recommendations_done}/{cycle.recommendations_total}{" "}
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
                        <Link href={cycleHref(cycle, producerId)}>
                          <CalendarDays className="size-3.5" />
                          Talhões
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link href={cycleHref(cycle, producerId, "purchase")}>
                          <ShoppingCart className="size-3.5" />
                          Lista de compra
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link href={cycleHref(cycle, producerId, "cost-plan")}>
                          <Calculator className="size-3.5" />
                          Plano de custo
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link href={stockHref}>
                          <Boxes className="size-3.5" />
                          Estoque
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {producerId ? (
        <NewCycleDialog
          open={newCycleOpen}
          onOpenChange={setNewCycleOpen}
          farmId={farmId}
          producerId={producerId}
          onCreated={openCycle}
        />
      ) : null}

      <FarmSeasonsExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        farmName={selectedCycleSummary?.name ?? selectedCycle?.name ?? null}
        contextLabel="SAFRA"
        isLoading={exportLoading}
        items={exportItems}
      />
    </>
  );
}
