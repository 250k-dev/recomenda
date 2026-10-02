"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { routes } from "@recomenda/config";
import { Check, ChevronRight, Leaf, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@recomenda/ui/primitives/badge";
import { Button } from "@recomenda/ui/primitives/button";
import { Card, CardContent } from "@recomenda/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recomenda/ui/primitives/dialog";
import { EmptyState } from "@recomenda/ui/patterns/empty-state";
import { Input } from "@recomenda/ui/primitives/input";
import { ProgressBar } from "@recomenda/ui/patterns/progress-bar";
import { SectionToolbar } from "@/components/domain/section-toolbar";
import { StickyMobileCta } from "@/components/domain/sticky-mobile-cta";
import { ListCardsSkeleton } from "@/components/domain/page-skeletons";
import { HistoricalCycleFlag } from "@/components/domain/historical-cycle-flag";
import {
  useCreateCycle,
  useFarmCycles,
  useProducerFarms,
  useProducerPlotCycleUsage,
} from "@recomenda/api-hooks";
import { apiErrorMessage } from "@recomenda/api/api-error";
import {
  CyclePlotPicker,
  defaultPlotSelection,
  plotSelectionToInput,
  plotUsageMap,
  type PlotSelection,
} from "@/components/domain/cycle/cycle-plot-picker";
import type { CycleSummary } from "@recomenda/api/cycles";
import {
  cn,
  CROP_OPTIONS,
  cropsLabel,
  CYCLE_STATUS_LABELS,
  labelStatus,
} from "@recomenda/utils";

const fmtHa = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function cycleHref(
  cycle: Pick<CycleSummary, "id" | "farm_id">,
  producerId: string | null,
) {
  return routes.fazendas.safra(cycle.farm_id, cycle.id, {
    producer_id: producerId,
  });
}

/** Caixa de seleção no estilo dos cards do diálogo. */
function CheckBox({ checked }: { checked: boolean }) {
  return (
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
  );
}

/** Diálogo "Nova safra" em 2 passos: (1) destino, nome e culturas; (2) fazendas
 *  e talhões da safra (com área parcial). A lista de compra e a programação são
 *  montadas depois, dentro da safra, e cobrem só esses talhões. */
export function NewCycleDialog({
  open,
  onOpenChange,
  farmId,
  producerId,
  onCreated,
  defaultDestination = "current",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmId: string;
  producerId: string;
  onCreated?: (cycleId: string) => void;
  /** Histórico pré-seleciona arquivo de safra antiga. */
  defaultDestination?: "current" | "historical";
}) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState(
    `Safra ${currentYear}/${String(currentYear + 1).slice(-2)}`,
  );
  const [crops, setCrops] = useState<Set<string>>(new Set(["SOYBEAN"]));
  const [destination, setDestination] = useState<"current" | "historical">(
    defaultDestination,
  );
  const [closedAt, setClosedAt] = useState("");
  const [selectedFarms, setSelectedFarms] = useState<Set<string>>(
    new Set(farmId ? [farmId] : []),
  );
  const [plotSelection, setPlotSelection] = useState<PlotSelection>(new Map());
  const [plotsSeeded, setPlotsSeeded] = useState(false);
  const createCycle = useCreateCycle(farmId);
  const { data: producerFarms } = useProducerFarms(producerId);
  const usageQuery = useProducerPlotCycleUsage(producerId, open);
  const farms = useMemo(() => producerFarms ?? [], [producerFarms]);
  const isHistorical = destination === "historical";

  // Talhão → safras ativas em que já está (arquivo de safra antiga não disputa talhão).
  const usage = useMemo(
    () => (isHistorical ? plotUsageMap([]) : plotUsageMap(usageQuery.data)),
    [usageQuery.data, isHistorical],
  );

  // Onboarding / reabertura: realinha a seleção quando o dialog abre (ou muda a fazenda).
  const openSeed = open ? `${farmId}:${defaultDestination}` : null;
  const [prevOpenSeed, setPrevOpenSeed] = useState<string | null>(null);
  if (openSeed !== prevOpenSeed) {
    setPrevOpenSeed(openSeed);
    if (openSeed) {
      setStep(1);
      setSelectedFarms(new Set(farmId ? [farmId] : []));
      setDestination(defaultDestination);
      setClosedAt("");
      setPlotSelection(new Map());
      setPlotsSeeded(false);
    }
  }

  const pickerFarms = useMemo(
    () => farms.filter((f) => selectedFarms.has(f.id)),
    [farms, selectedFarms],
  );

  const toggleCrop = (value: string) => {
    setCrops((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleFarm = (id: string) => {
    const farm = farms.find((f) => f.id === id);
    const next = new Set(selectedFarms);
    if (next.has(id)) {
      // Sempre precisa sobrar ao menos uma fazenda selecionada.
      if (next.size <= 1) return;
      next.delete(id);
      // Sai a fazenda, saem os talhões dela.
      if (farm) {
        const nextPlots = new Map(plotSelection);
        for (const plot of farm.plots) nextPlots.delete(plot.id);
        setPlotSelection(nextPlots);
      }
    } else {
      next.add(id);
      // Entra a fazenda: marca os talhões dela que não estão em outra safra.
      if (farm) {
        setPlotSelection(
          new Map([...plotSelection, ...defaultPlotSelection([farm], usage)]),
        );
      }
    }
    setSelectedFarms(next);
  };

  const goToPlots = () => {
    if (!name.trim()) {
      toast.error("Dê um nome à safra.");
      return;
    }
    if (crops.size === 0) {
      toast.error("Selecione pelo menos uma cultura.");
      return;
    }
    if (isHistorical && !closedAt) {
      toast.error("Informe a data de encerramento da safra antiga.");
      return;
    }
    if (!plotsSeeded) {
      setPlotSelection(defaultPlotSelection(pickerFarms, usage));
      setPlotsSeeded(true);
    }
    setStep(2);
  };

  const hasAnyPlot = pickerFarms.some((f) => f.plots.length > 0);

  const submit = () => {
    if (selectedFarms.size === 0) {
      toast.error("Selecione pelo menos uma fazenda.");
      return;
    }
    const plots = plotSelectionToInput(plotSelection, pickerFarms);
    if (hasAnyPlot && plots.length === 0) {
      toast.error("Selecione pelo menos um talhão da safra.");
      return;
    }
    createCycle.mutate(
      {
        producer_id: producerId,
        name: name.trim(),
        crops: [...crops],
        farm_ids: [...selectedFarms],
        plots,
        ...(isHistorical
          ? { backfill: true, closed_at: closedAt }
          : {}),
      },
      {
        onSuccess: (cycle) => {
          onOpenChange(false);
          if (cycle.backfill) {
            toast.success(
              "Arquivo criado. Preencha a safra — o galpão de hoje não muda.",
            );
            router.push(
              routes.fazendas.safra(cycle.farm_id, cycle.id, {
                producer_id: producerId,
              }),
            );
            return;
          }
          toast.success(
            "Safra criada! Monte a lista de compra para liberar a programação.",
          );
          onCreated?.(cycle.id);
        },
        onError: (error) =>
          toast.error(apiErrorMessage(error, "Não foi possível criar a safra.")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Nova safra
            {isHistorical ? <HistoricalCycleFlag /> : null}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Passo {step} de 2 · {step === 1 ? "Nome e culturas" : "Fazendas e talhões"}
          </p>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2 pt-1">
          {step === 1 ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Destino
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        id: "current" as const,
                        title: "Safra atual",
                        hint: "Entra na operação e no galpão de hoje.",
                      },
                      {
                        id: "historical" as const,
                        title: "Já encerrada",
                        hint: "Arquivo no histórico. Não altera o estoque vivo.",
                      },
                    ] as const
                  ).map((opt) => {
                    const checked = destination === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          "cursor-pointer rounded-lg border px-3 py-2.5",
                          checked
                            ? "border-primary bg-primary-soft/40"
                            : "border-border hover:bg-hover/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="cycle-destination"
                          checked={checked}
                          onChange={() => setDestination(opt.id)}
                          className="sr-only"
                        />
                        <span className="block text-sm font-semibold">
                          {opt.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {opt.hint}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {isHistorical ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">
                    Encerrada em
                  </label>
                  <Input
                    type="date"
                    value={closedAt}
                    onChange={(e) => setClosedAt(e.target.value)}
                  />
                </div>
              ) : null}
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
                  A safra pode ter mais de uma cultura — cada talhão recebe uma
                  delas.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CROP_OPTIONS.map((crop) => {
                    const checked = crops.has(crop.value);
                    return (
                      <label
                        key={crop.value}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-hover/40"
                      >
                        <CheckBox checked={checked} />
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
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  {farms.length > 1 ? "Fazendas da safra" : "Fazenda da safra"}
                </label>
                {farms.length > 1 ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Uma safra pode reunir talhões de mais de uma fazenda do mesmo
                    produtor.
                  </p>
                ) : null}
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                  {farms.map((farm) => {
                    const checked = selectedFarms.has(farm.id);
                    const farmArea = farm.plots.reduce(
                      (s, p) => s + Number(p.area_hectares || 0),
                      0,
                    );
                    return (
                      <label
                        key={farm.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm",
                          farms.length > 1 ? "cursor-pointer hover:bg-hover/40" : "",
                        )}
                      >
                        <CheckBox checked={checked} />
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={farms.length <= 1}
                          onChange={() => toggleFarm(farm.id)}
                          className="sr-only"
                        />
                        <span className="min-w-0 flex-1 truncate">{farm.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {fmtHa(farmArea)} ha
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Talhões da safra
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  A lista de compra e a programação desta safra cobrem só os
                  talhões marcados. Separou talhões para outra cultura? Crie
                  uma safra para eles.
                </p>
                <CyclePlotPicker
                  farms={pickerFarms}
                  selection={plotSelection}
                  onChange={setPlotSelection}
                  usage={usage}
                />
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border px-6 py-4">
          {step === 1 ? (
            <>
              <Button
                className="flex-1"
                onClick={goToPlots}
                disabled={usageQuery.isLoading}
              >
                Escolher talhões
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={submit}
                disabled={createCycle.isPending}
              >
                {createCycle.isPending ? "Criando..." : "Criar safra"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Lista de safras da fazenda (cards de `crop_cycles`). */
export function FarmCyclesSection({
  farmId,
  producerId,
  /** Botão "Nova safra" no toolbar — desligado na ficha da fazenda (criação fica no produtor). */
  showCreateCycle = true,
}: {
  farmId: string;
  producerId: string | null;
  showCreateCycle?: boolean;
}) {
  const router = useRouter();
  const { data: cycles, isLoading } = useFarmCycles(farmId);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [search, setSearch] = useState("");

  const visibleCycles = (cycles ?? []).filter(
    (c) => c.status === "ACTIVE" && !c.backfill,
  );
  const filteredCycles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return visibleCycles;
    return visibleCycles.filter((cycle) =>
      cycle.name.toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [visibleCycles, search]);

  /** Após criar safra: vai direto montar a lista (obrigatória antes da programação). */
  const openCycleListWizard = (cycleId: string) => {
    router.push(
      routes.fazendas.novaListaDeCompra(farmId, {
        producer_id: producerId,
        cycle_id: cycleId,
      }),
    );
  };

  const openCycle = (cycleId: string) => {
    router.push(cycleHref({ id: cycleId, farm_id: farmId }, producerId));
  };

  if (isLoading) return <ListCardsSkeleton count={3} />;

  return (
    <>
      <div>
        <SectionToolbar
          title="Safras ativas desta fazenda"
          search={
            visibleCycles.length > 0
              ? {
                  value: search,
                  onChange: setSearch,
                  placeholder: "Buscar safra…",
                }
              : undefined
          }
          actions={
            showCreateCycle && producerId ? (
              <Button
                className="hidden h-10 gap-1.5 sm:inline-flex"
                onClick={() => setNewCycleOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Nova safra
              </Button>
            ) : null
          }
        />

        {visibleCycles.length === 0 ? (
          <EmptyState
            title="Nenhuma safra ativa nesta fazenda."
            description="Crie a safra pelo produtor (aba Safras) ou inclua esta fazenda em uma safra existente."
            action={
              showCreateCycle && producerId ? (
                <Button size="sm" onClick={() => setNewCycleOpen(true)}>
                  Criar primeira safra
                </Button>
              ) : undefined
            }
          />
        ) : filteredCycles.length === 0 ? (
          <EmptyState
            variant="inline"
            title="Nenhuma safra encontrada."
            description={`Não há safras com o nome "${search.trim()}".`}
          />
        ) : (
          <div className="space-y-3">
            {filteredCycles.map((cycle) => {
              const pct = cycle.progress_pct;
              const showProgress = cycle.recommendations_total > 0;
              return (
                <Card
                  key={cycle.id}
                  className="gap-0 p-0 overflow-hidden transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <CardContent className="p-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-hover/30"
                      onClick={() => openCycle(cycle.id)}
                    >
                      <span className="flex items-center justify-center size-10 shrink-0 rounded-xl bg-primary-soft text-primary-strong">
                        <Leaf className="size-5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold truncate text-text-strong">
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
                              {labelStatus(CYCLE_STATUS_LABELS, cycle.status)}
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
                            cropsLabel(cycle.crops),
                            cycle.is_planning
                              ? "sem talhões programados"
                              : `${cycle.plots_count} ${cycle.plots_count === 1 ? "talhão" : "talhões"}`,
                            cycle.area_ha > 0
                              ? `${fmtHa(cycle.area_ha)} ha`
                              : null,
                            cycle.recommendations_total > 0
                              ? `${cycle.recommendations_done}/${cycle.recommendations_total} aplicadas`
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

                    {showProgress ? (
                      <div className="px-4 py-3 border-t border-border bg-rail lg:hidden">
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {cycle.recommendations_done}/
                            {cycle.recommendations_total} aplicadas
                          </span>
                          <span className="font-semibold tabular-nums text-primary-strong">
                            {pct}%
                          </span>
                        </div>
                        <ProgressBar value={pct} className="h-1.5" />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {producerId ? (
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
      ) : null}

      {producerId ? (
        <NewCycleDialog
          open={newCycleOpen}
          onOpenChange={setNewCycleOpen}
          farmId={farmId}
          producerId={producerId}
          onCreated={openCycleListWizard}
        />
      ) : null}
    </>
  );
}
